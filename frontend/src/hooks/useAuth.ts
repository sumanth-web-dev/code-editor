import { useState, useEffect, useCallback } from 'react';
import { User, AuthTokens, LoginRequest, RegisterRequest, AuthState } from '../types';
import { authService } from '../services/authService';
import { getErrorMessage } from '../utils/errorUtils';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    tokens: null,
    loading: true,
    error: null,
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const isAuthenticated = authService.isAuthenticated();
        const user = authService.getCurrentUser();
        const accessToken = authService.getAccessToken();
        
        setAuthState({
          isAuthenticated,
          user,
          tokens: accessToken ? { 
            access_token: accessToken, 
            refresh_token: localStorage.getItem('refresh_token') || '',
            token_type: 'Bearer',
            expires_in: 3600
          } : null,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to initialize authentication',
        }));
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authService.login(credentials);
      setAuthState({
        isAuthenticated: true,
        user: response.user,
        tokens: response.tokens,
        loading: false,
        error: null,
      });
      return response;
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
      throw error;
    }
  }, []);

  const register = useCallback(async (userData: RegisterRequest) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authService.register(userData);
      setAuthState({
        isAuthenticated: true,
        user: response.user,
        tokens: response.tokens,
        loading: false,
        error: null,
      });
      return response;
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        isAuthenticated: false,
        user: null,
        tokens: null,
        loading: false,
        error: null,
      });
    }
  }, []);

  const updateProfile = useCallback(async (userData: Partial<User>) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const updatedUser = await authService.updateProfile(userData);
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
        loading: false,
        error: null,
      }));
      
      return updatedUser;
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: getErrorMessage(error),
      }));
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!authState.isAuthenticated) return;
    
    try {
      const user = await authService.getProfile();
      setAuthState(prev => ({ ...prev, user }));
      return user;
    } catch (error: any) {
      console.error('Failed to refresh profile:', error);
      // Don't update error state for background refresh
    }
  }, [authState.isAuthenticated]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      await authService.changePassword(currentPassword, newPassword);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: null,
      }));
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: getErrorMessage(error),
      }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  // Utility methods
  const hasRole = useCallback((role: string) => {
    return authState.user?.role === role;
  }, [authState.user]);

  const isAdmin = useCallback(() => {
    return hasRole('admin');
  }, [hasRole]);

  const isEditor = useCallback(() => {
    return hasRole('editor') || hasRole('admin');
  }, [hasRole]);

  return {
    // State
    ...authState,
    
    // Actions
    login,
    register,
    logout,
    updateProfile,
    refreshProfile,
    changePassword,
    clearError,
    
    // Utilities
    hasRole,
    isAdmin,
    isEditor,
  };
};

export default useAuth;