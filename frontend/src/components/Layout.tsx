import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { usePaymentContext } from '../contexts/PaymentContext';
import AuthModal from './AuthModal';
import SubscriptionModal from './SubscriptionModal';
import UpgradeButton from './UpgradeButton';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuthContext();
  const { hasActiveSubscription, getSubscriptionStatus } = usePaymentContext();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const subscriptionStatus = getSubscriptionStatus();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserMenu]);

  const handleAuthSuccess = (user: any, tokens: any) => {
    setShowAuthModal(false);
    // Optionally redirect or refresh
  };

  const handleSubscriptionSuccess = () => {
    setShowSubscriptionModal(false);
    // Refresh subscription status
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    navigate('/editor');
  };

  const isActivePage = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/editor" className="logo">
              <h1>Multi-Language Code Editor</h1>
            </Link>
          </div>

          <nav className="header-nav">
            <Link 
              to="/editor" 
              className={`nav-link ${isActivePage('/editor') ? 'active' : ''}`}
            >
              Editor
            </Link>
            
            {isAuthenticated && (
              <>
                <Link 
                  to="/dashboard" 
                  className={`nav-link ${isActivePage('/dashboard') ? 'active' : ''}`}
                >
                  Dashboard
                </Link>
                
                <Link 
                  to="/subscriptions" 
                  className={`nav-link ${isActivePage('/subscriptions') ? 'active' : ''}`}
                >
                  Subscriptions
                </Link>
                
                {user?.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    className={`nav-link admin-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>

          <div className="header-right">
            {/* Subscription Status */}
            {isAuthenticated && (
              <div className="subscription-status">
                {subscriptionStatus.isActive ? (
                  <span className="status-badge active">
                    Premium ({subscriptionStatus.daysRemaining} days)
                  </span>
                ) : (
                  <UpgradeButton variant="header" />
                )}
              </div>
            )}

            {/* User Menu or Auth Buttons */}
            {isAuthenticated && user ? (
              <div className="user-menu" ref={userMenuRef}>
                <button 
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <span className="user-avatar">
                    {user.first_name?.[0] || user.name?.[0] || 'U'}{user.last_name?.[0] || user.name?.[1] || ''}
                  </span>
                  <span className="user-name">
                    {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name || user.email}
                  </span>
                </button>
                
                {showUserMenu && (
                  <div className="user-dropdown">
                    <div className="user-info">
                      <p className="user-email">{user.email}</p>
                      <p className="user-role">{user.role}</p>
                    </div>
                    <div className="dropdown-divider"></div>
                    <Link 
                      to="/profile" 
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Profile Settings
                    </Link>
                    <Link 
                      to="/subscriptions" 
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      My Subscriptions
                    </Link>
                    <div className="dropdown-divider"></div>
                    <button 
                      className="dropdown-item logout-item"
                      onClick={handleLogout}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <button 
                  className="auth-button login-button"
                  onClick={() => setShowAuthModal(true)}
                >
                  Sign In
                </button>
                <button 
                  className="auth-button register-button"
                  onClick={() => setShowAuthModal(true)}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="layout-main">
        {children}
      </main>

      {/* Modals */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      )}

      {showSubscriptionModal && isAuthenticated && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          onSubscriptionSuccess={handleSubscriptionSuccess}
          user={user}
        />
      )}
    </div>
  );
};

export default Layout;