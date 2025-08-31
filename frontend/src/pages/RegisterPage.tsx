import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errorUtils';
import NetworkStatus from '../components/NetworkStatus';
import './BeautifulAuthPages.css';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading, error, clearError } = useAuthContext();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    role: 'student' as 'student' | 'editor',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNetworkStatus, setShowNetworkStatus] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Clear errors when component mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (error) clearError();
    if (validationErrors.length > 0) setValidationErrors([]);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    // Name validation
    if (formData.first_name.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }
    if (formData.last_name.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.push('Please enter a valid email address');
    }
    
    // Password validation
    if (formData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (formData.password !== formData.confirmPassword) {
      errors.push('Passwords do not match');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setShowNetworkStatus(false);

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      // Navigation will be handled by useEffect above
    } catch (err: any) {
      // Show network status if it's a network-related error
      const errorMsg = getErrorMessage(err);
      if (errorMsg.includes('Network error') || 
          errorMsg.includes('Cannot connect') || 
          errorMsg.includes('Connection refused') ||
          errorMsg.includes('Cannot reach') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('ECONNREFUSED') ||
          errorMsg.includes('ERR_NETWORK') ||
          errorMsg.includes('fetch')) {
        setShowNetworkStatus(true);
      }
      // Error is handled by the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setShowNetworkStatus(false);
    clearError();
  };

  const allErrors = [...validationErrors, ...(error ? [error] : [])];

  return (
    <div className="beautiful-auth-page">
      <div className="beautiful-auth-background">
        <div className="beautiful-auth-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
      
      <div className="beautiful-auth-container">
        <div className="beautiful-auth-card register-card">
          <div className="beautiful-auth-header">
            <div className="beautiful-logo">
              <div className="logo-icon">
                <span>{'</>'}</span>
              </div>
              <h1>Code Editor</h1>
            </div>
            <h2>Create Account</h2>
            <p>Join thousands of developers and start coding today</p>
          </div>

          <form onSubmit={handleSubmit} className="beautiful-auth-form">
            {allErrors.length > 0 && !showNetworkStatus && (
              <div className="beautiful-error-message">
                <div className="error-icon">⚠️</div>
                <div className="error-list">
                  {allErrors.map((err, index) => (
                    <div key={index}>{err}</div>
                  ))}
                </div>
              </div>
            )}

            {showNetworkStatus && (
              <NetworkStatus onRetry={handleRetry} showDiagnostics={true} />
            )}

            <div className="beautiful-form-row">
              <div className="beautiful-form-group">
                <label htmlFor="first_name" className="beautiful-label">
                  First Name
                </label>
                <div className="beautiful-input-wrapper">
                  <div className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <input
                    id="first_name"
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting || loading}
                    placeholder="Enter first name"
                    className="beautiful-input"
                  />
                </div>
              </div>

              <div className="beautiful-form-group">
                <label htmlFor="last_name" className="beautiful-label">
                  Last Name
                </label>
                <div className="beautiful-input-wrapper">
                  <div className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <input
                    id="last_name"
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting || loading}
                    placeholder="Enter last name"
                    className="beautiful-input"
                  />
                </div>
              </div>
            </div>

            <div className="beautiful-form-group">
              <label htmlFor="email" className="beautiful-label">
                Email Address
              </label>
              <div className="beautiful-input-wrapper">
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting || loading}
                  placeholder="Enter your email"
                  className="beautiful-input"
                />
              </div>
            </div>

            <div className="beautiful-form-group">
              <label htmlFor="role" className="beautiful-label">
                Account Type
              </label>
              <div className="beautiful-input-wrapper">
                <div className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <path d="M20 8v6"/>
                    <path d="M23 11h-6"/>
                  </svg>
                </div>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  disabled={isSubmitting || loading}
                  className="beautiful-input beautiful-select"
                >
                  <option value="student">Student - Learning to code</option>
                  <option value="editor">Developer - Professional coder</option>
                </select>
              </div>
            </div>

            <div className="beautiful-form-row">
              <div className="beautiful-form-group">
                <label htmlFor="password" className="beautiful-label">
                  Password
                </label>
                <div className="beautiful-input-wrapper">
                  <div className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <circle cx="12" cy="16" r="1"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting || loading}
                    placeholder="Create password"
                    className="beautiful-input"
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="beautiful-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="beautiful-form-group">
                <label htmlFor="confirmPassword" className="beautiful-label">
                  Confirm Password
                </label>
                <div className="beautiful-input-wrapper">
                  <div className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <circle cx="12" cy="16" r="1"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting || loading}
                    placeholder="Confirm password"
                    className="beautiful-input"
                  />
                  <button
                    type="button"
                    className="beautiful-password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="beautiful-form-options">
              <label className="beautiful-checkbox">
                <input type="checkbox" required />
                <span className="checkmark"></span>
                <span className="checkbox-text">
                  I agree to the <Link to="/terms" className="beautiful-link">Terms of Service</Link> and <Link to="/privacy" className="beautiful-link">Privacy Policy</Link>
                </span>
              </label>
            </div>

            <button 
              type="submit" 
              className="beautiful-submit-btn"
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? (
                <>
                  <div className="loading-spinner"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14"/>
                    <path d="M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="beautiful-auth-footer">
            <p>
              Already have an account? 
              <Link to="/login" className="beautiful-link-primary">
                Sign in here
              </Link>
            </p>
          </div>

          <div className="beautiful-social-section">
            <div className="social-divider">
              <span>Or sign up with</span>
            </div>
            <div className="social-buttons">
              <button className="social-btn google-btn" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button className="social-btn github-btn" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;