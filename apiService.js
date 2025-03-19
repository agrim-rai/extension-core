/**
 * API Service for handling all communication with the backend
 */
class ApiService {
  constructor() {
    // Load configuration
    this.config = window.syntaxSentryConfig || {
      api: {
        baseUrl: "https://extension-web-mu.vercel.app",
        endpoints: { activity: "/api/activity" },
        request: { maxRetries: 3, retryDelay: 1000, timeout: 10000 }
      },
      debug: true
    };
    
    // Queue for storing failed requests
    this.queue = [];
    
    // Load any persisted queue items from localStorage
    this.loadQueueFromStorage();
    
    // Initialize offline detection
    this.isOffline = !navigator.onLine;
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.isOffline = true);
    
    // Process queue periodically
    setInterval(() => this.processQueue(), 60000); // Every minute
    
    // Add a more frequent retry for 500 errors
    setInterval(() => this.retryServerErrors(), 15000); // Every 15 seconds
  }
  
  /**
   * Load queue from localStorage
   */
  loadQueueFromStorage() {
    try {
      const storedQueue = localStorage.getItem('syntaxSentryQueue');
      if (storedQueue) {
        const parsedQueue = JSON.parse(storedQueue);
        if (Array.isArray(parsedQueue)) {
          this.queue = parsedQueue;
          this.log(`Loaded ${this.queue.length} items from persistent storage`);
        }
      }
    } catch (err) {
      this.error("Error loading queue from storage:", err);
    }
  }
  
  /**
   * Save queue to localStorage
   */
  saveQueueToStorage() {
    try {
      // Only store up to 100 items to avoid localStorage limits
      const queueToStore = this.queue.slice(0, 100);
      localStorage.setItem('syntaxSentryQueue', JSON.stringify(queueToStore));
    } catch (err) {
      this.error("Error saving queue to storage:", err);
    }
  }
          
  /**
   * Log a message if debug mode is enabled
   */
  log(...args) {
    if (this.config.debug) {
      console.log("[Syntax Sentry API]", ...args);
    }
  }
  
  /**
   * Log an error
   */
  error(...args) {
    console.error("[Syntax Sentry API Error]", ...args);
  }
  
  /**
   * Handle coming back online
   */
  handleOnline() {
    this.isOffline = false;
    this.log("Back online, processing queue...");
    this.processQueue();
  }
  
  /**
   * Process the queue of pending requests
   */
  async processQueue() {
    if (this.isOffline || this.queue.length === 0) return;
    
    this.log(`Processing queue: ${this.queue.length} items`);
    
    // Process up to 10 items at a time to avoid overwhelming the server
    const batch = this.queue.splice(0, 10);
    let failedItems = [];
    
    for (const item of batch) {
      try {
        // Skip items that have exceeded max retries
        if (item.retries >= this.config.api.request.maxRetries) {
          this.error("Max retries exceeded for request, dropping:", item);
          continue;
        }
        
        // Add timestamp to track retry time
        item.lastRetry = Date.now();
        
        await this.sendRequest(item.endpoint, item.data, item.retries);
      } catch (err) {
        // If still failing, put back in queue with increased retry count
        failedItems.push({
          ...item,
          retries: item.retries + 1,
          lastError: err.message
        });
      }
    }
    
    // Add failed items back to the queue
    if (failedItems.length > 0) {
      this.queue = [...failedItems, ...this.queue];
      this.saveQueueToStorage();
    }
  }
  
  /**
   * Retry requests that failed with server errors (500)
   * These might be temporary server issues that can be resolved quickly
   */
  async retryServerErrors() {
    if (this.isOffline || this.queue.length === 0) return;
    
    // Find items that failed with 500 errors
    const serverErrorItems = this.queue.filter(item => 
      item.lastError && item.lastError.includes('500') && 
      // Only retry if it's been at least 5 seconds since last retry
      (!item.lastRetry || Date.now() - item.lastRetry > 5000)
    );
    
    if (serverErrorItems.length === 0) return;
    
    this.log(`Retrying ${serverErrorItems.length} items with server errors`);
    
    // Remove these items from the main queue
    this.queue = this.queue.filter(item => 
      !(item.lastError && item.lastError.includes('500'))
    );
    
    // Process server error items
    for (const item of serverErrorItems) {
      try {
        // Skip items that have exceeded max retries
        if (item.retries >= this.config.api.request.maxRetries * 2) { // Allow more retries for server errors
          this.error("Max retries exceeded for server error request, dropping:", item);
          continue;
        }
        
        // Add timestamp to track retry time
        item.lastRetry = Date.now();
        
        await this.sendRequest(item.endpoint, item.data, item.retries);
      } catch (err) {
        // If still failing, put back in queue with increased retry count
        this.queue.push({
          ...item,
          retries: item.retries + 1,
          lastError: err.message
        });
      }
    }
    
    // Save updated queue
    this.saveQueueToStorage();
  }
  
  /**
   * Send data to the specified endpoint
   * @param {string} endpoint - API endpoint
   * @param {object} data - Data to send
   * @returns {Promise} - Promise that resolves when the request is complete
   */
  async sendActivity(data) {
    try {
      // Validate data
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid data: must be an object");
      }
      
      // Sanitize data to prevent common issues
      const sanitizedData = this.sanitizeData(data);
      
      // Add timestamp if not present
      if (!sanitizedData.timestamp) {
        sanitizedData.timestamp = Date.now();
      }
      
      // Add client info
      sanitizedData.clientInfo = sanitizedData.clientInfo || {};
      sanitizedData.clientInfo.userAgent = navigator.userAgent;
      sanitizedData.clientInfo.language = navigator.language;
      sanitizedData.clientInfo.platform = navigator.platform;
      
      return await this.sendRequest(this.config.api.endpoints.activity, sanitizedData);
    } catch (err) {
      this.error("Error sending activity:", err);
      
      // Queue the request for later
      const queueItem = {
        endpoint: this.config.api.endpoints.activity,
        data,
        retries: 0,
        timestamp: Date.now(),
        lastError: err.message
      };
      
      this.queue.push(queueItem);
      this.saveQueueToStorage();
      
      // Return a response indicating the request was queued
      return {
        success: false,
        queued: true,
        error: err.message,
        queueLength: this.queue.length
      };
    }
  }
  
  /**
   * Sanitize data to prevent common issues
   * @param {object} data - Data to sanitize
   * @returns {object} - Sanitized data
   */
  sanitizeData(data) {
    try {
      // Create a deep copy to avoid modifying the original
      const sanitized = JSON.parse(JSON.stringify(data));
      
      // Truncate long strings to prevent payload size issues
      const maxStringLength = 10000;
      
      const truncateStrings = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string' && obj[key].length > maxStringLength) {
            obj[key] = obj[key].substring(0, maxStringLength) + '... [truncated]';
          } else if (typeof obj[key] === 'object') {
            truncateStrings(obj[key]);
          }
        });
      };
      
      truncateStrings(sanitized);
      
      // Remove any potentially problematic fields
      const removeProblematicFields = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        // List of fields that might cause issues
        const problematicFields = ['__proto__', 'constructor', 'prototype'];
        
        problematicFields.forEach(field => {
          if (field in obj) {
            delete obj[field];
          }
        });
        
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'object') {
            removeProblematicFields(obj[key]);
          }
        });
      };
      
      removeProblematicFields(sanitized);
      
      return sanitized;
    } catch (err) {
      this.error("Error sanitizing data:", err);
      return data; // Return original if sanitization fails
    }
  }
  
  /**
   * Send a request to the API with retry logic
   * @param {string} endpoint - API endpoint
   * @param {object} data - Data to send
   * @param {number} retryCount - Current retry count
   * @returns {Promise} - Promise that resolves with the response
   */
  async sendRequest(endpoint, data, retryCount = 0) {
    // Don't attempt if offline
    if (this.isOffline) {
      throw new Error("Device is offline");
    }
    
    try {
      const url = `${this.config.api.baseUrl}${endpoint}`;
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.api.request.timeout);
      
      // Add request ID for tracking
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      data._requestId = requestId;
      
      this.log(`[${requestId}] Sending request to ${url}`, data);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Syntax-Sentry-Version": "1.0"
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Handle non-200 responses
      if (!response.ok) {
        const errorText = await response.text();
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorText: errorText,
          requestId: requestId,
          requestData: JSON.stringify(data).substring(0, 500) // Truncate for logging
        };
        
        // Log detailed error information
        this.error(`[${requestId}] Server error response:`, errorDetails);
        
        // Special handling for 500 errors - they might be temporary server issues
        if (response.status === 500) {
          // For 500 errors, we'll retry with increased delay
          if (retryCount < this.config.api.request.maxRetries) {
            const delay = this.config.api.request.retryDelay * Math.pow(2, retryCount) * 1.5; // Increased delay for server errors
            this.log(`[${requestId}] Server error (500), retrying in ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.sendRequest(endpoint, data, retryCount + 1);
          }
        }
        
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      this.log(`[${requestId}] Request successful:`, result);
      return result;
    } catch (err) {
      const requestId = data._requestId || 'unknown';
      
      // Handle abort/timeout
      if (err.name === 'AbortError') {
        this.error(`[${requestId}] Request timed out`);
        throw new Error("Request timed out");
      }
      
      // Handle network errors (likely temporary)
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        this.error(`[${requestId}] Network error:`, err.message);
        
        // Always retry network errors if under max retries
        if (retryCount < this.config.api.request.maxRetries) {
          const delay = this.config.api.request.retryDelay * Math.pow(2, retryCount);
          this.log(`[${requestId}] Network error, retrying in ${delay}ms...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.sendRequest(endpoint, data, retryCount + 1);
        }
      }
      
      // Handle other errors
      this.error(`[${requestId}] Request failed (attempt ${retryCount + 1}/${this.config.api.request.maxRetries + 1}):`, err);
      
      // Retry logic
      if (retryCount < this.config.api.request.maxRetries) {
        // Exponential backoff
        const delay = this.config.api.request.retryDelay * Math.pow(2, retryCount);
        this.log(`[${requestId}] Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendRequest(endpoint, data, retryCount + 1);
      }
      
      // Max retries exceeded
      throw err;
    }
  }
}

// Create and export a singleton instance
const apiService = new ApiService();

// Export the service
if (typeof module !== 'undefined' && module.exports) {
  module.exports = apiService;
} else {
  window.syntaxSentryApi = apiService;
} 