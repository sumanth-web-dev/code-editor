/**
 * Network utility functions for diagnosing connection issues
 */

const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

/**
 * Check if the backend server is reachable
 */
export const checkBackendConnection = async (): Promise<{
  isConnected: boolean;
  error?: string;
  details?: any;
}> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        isConnected: true,
        details: data
      };
    } else {
      return {
        isConnected: false,
        error: `Server responded with status ${response.status}`,
        details: { status: response.status, statusText: response.statusText }
      };
    }
  } catch (error: any) {
    let errorMessage = 'Unknown error';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Connection timeout - server is not responding';
    } else if (error.message.includes('fetch')) {
      errorMessage = 'Cannot reach server - check if backend is running';
    } else {
      errorMessage = error.message;
    }

    return {
      isConnected: false,
      error: errorMessage,
      details: {
        name: error.name,
        message: error.message,
        code: error.code
      }
    };
  }
};

/**
 * Test authentication endpoints specifically
 */
export const testAuthEndpoints = async (): Promise<{
  loginEndpoint: boolean;
  registerEndpoint: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let loginEndpoint = false;
  let registerEndpoint = false;

  // Test login endpoint with invalid data (should return 400, not network error)
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: '', password: '' })
    });
    
    // We expect a 400 error for empty credentials, which means the endpoint is reachable
    if (response.status === 400) {
      loginEndpoint = true;
    } else {
      errors.push(`Login endpoint returned unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    errors.push(`Login endpoint error: ${error.message}`);
  }

  // Test register endpoint with invalid data (should return 400, not network error)
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: '', password: '' })
    });
    
    // We expect a 400 error for empty credentials, which means the endpoint is reachable
    if (response.status === 400) {
      registerEndpoint = true;
    } else {
      errors.push(`Register endpoint returned unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    errors.push(`Register endpoint error: ${error.message}`);
  }

  return {
    loginEndpoint,
    registerEndpoint,
    errors
  };
};

/**
 * Get network diagnostic information
 */
export const getNetworkDiagnostics = async () => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    environment: process.env.NODE_ENV,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    connection: (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection,
  };

  const backendCheck = await checkBackendConnection();
  const authCheck = await testAuthEndpoints();

  return {
    ...diagnostics,
    backend: backendCheck,
    auth: authCheck,
    recommendations: generateRecommendations(backendCheck, authCheck)
  };
};

/**
 * Generate recommendations based on diagnostic results
 */
const generateRecommendations = (
  backendCheck: { isConnected: boolean; error?: string },
  authCheck: { loginEndpoint: boolean; registerEndpoint: boolean; errors: string[] }
): string[] => {
  const recommendations: string[] = [];

  if (!backendCheck.isConnected) {
    if (backendCheck.error?.includes('timeout')) {
      recommendations.push('Backend server is not responding. Check if the server is running.');
    } else if (backendCheck.error?.includes('Cannot reach server')) {
      recommendations.push('Cannot connect to backend. Verify the server is running on the correct port.');
      recommendations.push('Check if REACT_APP_API_URL environment variable is set correctly.');
    } else {
      recommendations.push('Backend connection failed. Check server status and network connectivity.');
    }
  }

  if (!authCheck.loginEndpoint || !authCheck.registerEndpoint) {
    recommendations.push('Authentication endpoints are not accessible. Check backend auth routes.');
  }

  if (authCheck.errors.length > 0) {
    recommendations.push('Authentication service errors detected. Check backend logs for details.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Network diagnostics look good. The issue might be with request data or server logic.');
  }

  return recommendations;
};