import axios, { AxiosResponse } from 'axios';
import { ExecutionRequest, ExecutionResult, Language } from '../types';
import { performanceMonitor } from '../utils/performance';

// Configure base URL for API calls with better fallback logic
const getApiBaseUrl = () => {
  // Check if we're in development and the backend might be running on a different port
  if (process.env.NODE_ENV === 'development') {
    // Try to detect if we're running in a development environment
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.REACT_APP_API_URL || 'http://localhost:5000';
    }
  }
  
  // In production or when not on localhost, use relative URLs
  return process.env.REACT_APP_API_URL || '';
};

const API_BASE_URL = getApiBaseUrl();

console.log('API Configuration:', {
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  NODE_ENV: process.env.NODE_ENV,
  API_BASE_URL: API_BASE_URL,
  hostname: window.location.hostname,
  port: window.location.port
});

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 35000, // 35 seconds to account for 30s execution timeout + buffer
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url
    });

    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Code execution took too long (>30 seconds).');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Connection refused. The backend server is not running on the expected port. Please start the backend server.');
    } else if (error.code === 'ERR_NETWORK') {
      throw new Error('Network error. Cannot reach the backend server. Please check if the backend is running and accessible.');
    } else if (error.response?.status === 500) {
      throw new Error('Server error occurred. Please try again.');
    } else if (error.response?.status === 400) {
      // Handle validation errors from backend
      const errorData = error.response.data;
      if (errorData?.error?.message) {
        throw new Error(errorData.error.message);
      }
      throw new Error('Invalid request. Please check your input.');
    } else if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait before trying again.');
    } else if (!error.response) {
      throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
    }

    throw error;
  }
);

export class ApiService {
  /**
   * Execute code in the specified language
   */
  static async executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
    return performanceMonitor.measureApiRequest('execute_code', async () => {
      try {
        const response: AxiosResponse<{
          success: boolean;
          output: string;
          execution_time: number;
          timeout: boolean;
          session_id?: string;
          error?: {
            type: string;
            message: string;
            details?: string;
          };
        }> = await apiClient.post('/api/execute', request);

        if (response.data.success) {
          return {
            output: response.data.output,
            executionTime: response.data.execution_time,
            error: undefined
          };
        } else {
          const errorMessage = response.data.error?.message || 'Code execution failed';
          const errorDetails = response.data.error?.details;
          throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
        }
      } catch (error: any) {
        console.error('Code execution error:', error);

        // If it's already a formatted error from interceptor, re-throw it
        if (error.message && typeof error.message === 'string') {
          throw error;
        }

        throw new Error('Failed to execute code. Please try again.');
      }
    });
  }

  /**
   * Get list of supported languages
   */
  static async getLanguages(): Promise<Language[]> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        languages: Language[];
        count: number;
        error?: { message: string; details?: string };
      }> = await apiClient.get('/api/languages');

      if (response.data.success && response.data.languages) {
        return response.data.languages;
      } else {
        throw new Error(response.data.error?.message || 'Failed to fetch languages');
      }
    } catch (error: any) {
      console.error('Languages fetch error:', error);
      throw new Error(error.message || 'Failed to fetch supported languages');
    }
  }

  /**
   * Health check endpoint
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await apiClient.get('/api/health');
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export default ApiService;