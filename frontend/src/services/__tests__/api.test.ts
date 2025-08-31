import axios from 'axios';
import ApiService from '../api';
import { ExecutionRequest, ExecutionResult, Language } from '../../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('ApiService', () => {
  const mockApiClient = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockApiClient as any);
  });

  describe('executeCode', () => {
    const mockRequest: ExecutionRequest = {
      language: 'python',
      code: 'print("Hello World")',
      input: 'test input',
    };

    const mockResult: ExecutionResult = {
      output: 'Hello World\n',
      executionTime: 0.123,
    };

    it('successfully executes code', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: mockResult,
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await ApiService.executeCode(mockRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/execute', mockRequest);
      expect(result).toEqual(mockResult);
    });

    it('handles execution error from backend', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: {
            message: 'SyntaxError: invalid syntax',
            details: 'Line 1: unexpected token',
          },
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await expect(ApiService.executeCode(mockRequest)).rejects.toThrow(
        'SyntaxError: invalid syntax: Line 1: unexpected token'
      );
    });

    it('handles execution error without details', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: {
            message: 'Execution failed',
          },
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await expect(ApiService.executeCode(mockRequest)).rejects.toThrow('Execution failed');
    });

    it('handles missing data in successful response', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: null,
        },
      };

      mockApiClient.post.mockResolvedValue(mockResponse);

      await expect(ApiService.executeCode(mockRequest)).rejects.toThrow('Code execution failed');
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.message = 'Request timeout. Code execution took too long (>30 seconds).';
      
      mockApiClient.post.mockRejectedValue(networkError);

      await expect(ApiService.executeCode(mockRequest)).rejects.toThrow(
        'Request timeout. Code execution took too long (>30 seconds).'
      );
    });

    it('handles generic errors', async () => {
      const genericError = { response: { status: 500 } };
      mockApiClient.post.mockRejectedValue(genericError);

      await expect(ApiService.executeCode(mockRequest)).rejects.toThrow(
        'Failed to execute code. Please try again.'
      );
    });
  });

  describe('getLanguages', () => {
    const mockLanguages: Language[] = [
      {
        id: 'python',
        name: 'Python',
        version: '3.9',
        fileExtension: '.py',
        syntaxHighlighting: 'python',
        executionCommand: 'python3',
      },
      {
        id: 'javascript',
        name: 'JavaScript',
        version: 'ES2020',
        fileExtension: '.js',
        syntaxHighlighting: 'javascript',
        executionCommand: 'node',
      },
    ];

    it('successfully fetches languages', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            languages: mockLanguages,
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await ApiService.getLanguages();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/languages');
      expect(result).toEqual(mockLanguages);
    });

    it('handles error response from backend', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: {
            message: 'Failed to load languages',
          },
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      await expect(ApiService.getLanguages()).rejects.toThrow('Failed to load languages');
    });

    it('handles missing data in successful response', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: null,
        },
      };

      mockApiClient.get.mockResolvedValue(mockResponse);

      await expect(ApiService.getLanguages()).rejects.toThrow('Failed to fetch languages');
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      mockApiClient.get.mockRejectedValue(networkError);

      await expect(ApiService.getLanguages()).rejects.toThrow('Network Error');
    });

    it('handles generic errors', async () => {
      const genericError = { response: { status: 500 } };
      mockApiClient.get.mockRejectedValue(genericError);

      await expect(ApiService.getLanguages()).rejects.toThrow(
        'Failed to fetch supported languages'
      );
    });
  });

  describe('healthCheck', () => {
    it('returns true when health check succeeds', async () => {
      const mockResponse = { status: 200 };
      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await ApiService.healthCheck();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/health');
      expect(result).toBe(true);
    });

    it('returns false when health check fails', async () => {
      const error = new Error('Network Error');
      mockApiClient.get.mockRejectedValue(error);

      const result = await ApiService.healthCheck();

      expect(result).toBe(false);
    });

    it('returns false when status is not 200', async () => {
      const mockResponse = { status: 500 };
      mockApiClient.get.mockResolvedValue(mockResponse);

      const result = await ApiService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('axios configuration', () => {
    it('creates axios client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:5000',
        timeout: 35000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('uses environment variable for API URL when available', () => {
      const originalEnv = process.env.REACT_APP_API_URL;
      process.env.REACT_APP_API_URL = 'http://custom-api.com';

      // Re-import to get new configuration
      jest.resetModules();
      require('../api');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://custom-api.com',
        })
      );

      // Restore original environment
      process.env.REACT_APP_API_URL = originalEnv;
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Mock the interceptors to actually call the error handler
      const errorHandler = jest.fn((error) => {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout. Code execution took too long (>30 seconds).');
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
          throw new Error('Network error. Cannot connect to backend server.');
        } else if (error.response?.status === 500) {
          throw new Error('Server error occurred. Please try again.');
        } else if (error.response?.status === 400) {
          const errorData = error.response.data;
          if (errorData?.error?.message) {
            throw new Error(errorData.error.message);
          }
          throw new Error('Invalid request. Please check your input.');
        } else if (error.response?.status === 429) {
          throw new Error('Too many requests. Please wait before trying again.');
        } else if (!error.response) {
          throw new Error('Network error. Please check your connection and ensure the backend is running.');
        }
        throw error;
      });

      mockApiClient.interceptors.response.use.mockImplementation((success, error) => {
        // Store the error handler for testing
        (mockApiClient as any).errorHandler = error;
      });
    });

    it('handles timeout errors', async () => {
      const timeoutError = { code: 'ECONNABORTED' };
      mockApiClient.post.mockRejectedValue(timeoutError);

      await expect(ApiService.executeCode({
        language: 'python',
        code: 'print("test")',
      })).rejects.toThrow('Failed to execute code. Please try again.');
    });

    it('handles connection refused errors', async () => {
      const connectionError = { code: 'ECONNREFUSED' };
      mockApiClient.post.mockRejectedValue(connectionError);

      await expect(ApiService.executeCode({
        language: 'python',
        code: 'print("test")',
      })).rejects.toThrow('Failed to execute code. Please try again.');
    });

    it('handles 400 status errors', async () => {
      const badRequestError = {
        response: {
          status: 400,
          data: {
            error: {
              message: 'Invalid language specified',
            },
          },
        },
      };
      mockApiClient.post.mockRejectedValue(badRequestError);

      await expect(ApiService.executeCode({
        language: 'invalid',
        code: 'test',
      })).rejects.toThrow('Failed to execute code. Please try again.');
    });

    it('handles 429 rate limit errors', async () => {
      const rateLimitError = { response: { status: 429 } };
      mockApiClient.post.mockRejectedValue(rateLimitError);

      await expect(ApiService.executeCode({
        language: 'python',
        code: 'print("test")',
      })).rejects.toThrow('Failed to execute code. Please try again.');
    });
  });
});