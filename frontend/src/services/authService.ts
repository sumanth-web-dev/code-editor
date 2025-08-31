import axios from 'axios';
import { 
  User, 
  AuthTokens, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse 
} from '../types';

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

console.log('Auth Service Configuration:', {
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  NODE_ENV: process.env.NODE_ENV,
  API_BASE_URL: API_BASE_URL,
  hostname: window.location.hostname,
  port: window.location.port
});

const authClient = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
  timeout: 30000, // Increased timeout to 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  // Add retry configuration
  validateStatus: function (status) {
    return status < 500; // Resolve only if the status code is less than 500
  }
});

// Add request interceptor to include auth token
authClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for token refresh and error handling
authClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('Auth API Error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url
    });

    const originalRequest = error.config;
    
    // Handle network errors with more specific messages
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. The server is taking too long to respond. Please try again.');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Connection refused. The backend server is not running on the expected port. Please start the backend server.');
    } else if (error.code === 'ERR_NETWORK') {
      throw new Error('Network error. Cannot reach the backend server. Please check if the backend is running and accessible.');
    } else if (error.message && error.message.includes('fetch')) {
      throw new Error('Network error. Unable to connect to the backend server. Please ensure it is running.');
    } else if (!error.response) {
      throw new Error('Network error. Please check your internet connection and ensure the backend server is running.');
    }
    
    // Handle token refresh for 401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await authClient.post('/refresh', {
            refresh_token: refreshToken
          });
          
          if (response.data.success) {
            const { tokens } = response.data;
            localStorage.setItem('access_token', tokens.access_token);
            localStorage.setItem('refresh_token', tokens.refresh_token);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
            return authClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        authService.logout();
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

class AuthService {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('Attempting login with:', { email: credentials.email });
      
      const response = await authClient.post('/login', credentials);
      
      console.log('Login response:', {
        status: response.status,
        success: response.data.success,
        hasUser: !!response.data.user,
        hasTokens: !!response.data.tokens
      });
      
      if (response.data.success) {
        const { user, tokens, session } = response.data;
        
        // Store tokens in localStorage
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        localStorage.setItem('user', JSON.stringify(user));
        if (session?.session_token) {
          localStorage.setItem('session_token', session.session_token);
        }
        
        return response.data;
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error details:', error);
      
      // Handle different types of errors
      if (error.message && error.message.includes('Cannot connect to server')) {
        throw error; // Re-throw network errors as-is
      }
      
      const errorMessage = error.response?.data?.error || error.message || 'Login failed';
      throw new Error(errorMessage);
    }
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('Attempting registration with:', { 
        email: userData.email, 
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role 
      });
      
      const response = await authClient.post('/register', userData);
      
      console.log('Registration response:', {
        status: response.status,
        success: response.data.success,
        hasUser: !!response.data.user,
        hasTokens: !!response.data.tokens
      });
      
      if (response.data.success) {
        const { user, tokens, session } = response.data;
        
        // Store tokens in localStorage
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('refresh_token', tokens.refresh_token);
        localStorage.setItem('user', JSON.stringify(user));
        if (session?.session_token) {
          localStorage.setItem('session_token', session.session_token);
        }
        
        return response.data;
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error details:', error);
      
      // Handle different types of errors
      if (error.message && error.message.includes('Cannot connect to server')) {
        throw error; // Re-throw network errors as-is
      }
      
      const errorMessage = error.response?.data?.error || error.message || 'Registration failed';
      throw new Error(errorMessage);
    }
  }

  async logout(): Promise<void> {
    try {
      const sessionToken = localStorage.getItem('session_token');
      await authClient.post('/logout', { session_token: sessionToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('session_token');
    }
  }

  async getProfile(): Promise<User> {
    try {
      const response = await authClient.get('/profile');
      
      if (response.data.success) {
        return response.data.user;
      } else {
        throw new Error(response.data.error || 'Failed to get profile');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get profile');
    }
  }

  async updateProfile(userData: Partial<User>): Promise<User> {
    try {
      const response = await authClient.put('/profile', userData);
      
      if (response.data.success) {
        // Update stored user data
        const updatedUser = response.data.user;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      } else {
        throw new Error(response.data.error || 'Failed to update profile');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to update profile');
    }
  }

  async forgotPassword(email: string): Promise<string> {
    try {
      const response = await authClient.post('/forgot-password', { email });
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to send reset email');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to send reset email');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<string> {
    try {
      const response = await authClient.post('/reset-password', {
        token,
        new_password: newPassword
      });
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to reset password');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to reset password');
    }
  }

  async verifyEmail(token: string): Promise<string> {
    try {
      const response = await authClient.post('/verify-email', { token });
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to verify email');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to verify email');
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const response = await authClient.post('/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to change password');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to change password');
    }
  }

  isEditor(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'editor' || user?.role === 'admin';
  }
}

export const authService = new AuthService();
export default authService;