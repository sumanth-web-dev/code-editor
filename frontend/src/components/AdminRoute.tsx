import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, user, loading, isAdmin } = useAuthContext();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="admin-route-loading">
        <LoadingSpinner message="Verifying admin access..." />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check admin role
  if (!isAdmin()) {
    return (
      <div className="admin-access-denied">
        <div className="access-denied-content">
          <h2>🔒 Admin Access Required</h2>
          <p>You need administrator privileges to access this area.</p>
          <div className="user-info">
            <p><strong>Current User:</strong> {user.first_name} {user.last_name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> {user.role}</p>
          </div>
          <div className="actions">
            <button 
              onClick={() => window.history.back()}
              className="back-button"
            >
              Go Back
            </button>
            <button 
              onClick={() => window.location.href = '/editor'}
              className="home-button"
            >
              Go to Editor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;