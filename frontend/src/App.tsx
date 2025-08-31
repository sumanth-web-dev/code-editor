import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/pages.css';
import Layout from './components/Layout';
import EditorPage from './pages/EditorPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PaymentPage from './pages/PaymentPage';
import AdminPanel from './pages/AdminPanel';
import ProfilePage from './pages/ProfilePage';
import AuthDemo from './pages/AuthDemo';
import { ErrorBoundary } from './components';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { AuthProvider } from './contexts/AuthContext';
import { PaymentProvider } from './contexts/PaymentContext';
import errorLogger from './services/errorLogger';
import './App.css';
import './pages/PaymentPage.css';

function App() {
  const handleAppError = (error: Error, errorInfo: React.ErrorInfo) => {
    errorLogger.logReactError(error, errorInfo, 'app_level');
  };

  return (
    <ErrorBoundary onError={handleAppError}>
      <AuthProvider>
        <PaymentProvider>
          <Router>
            <Layout>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Navigate to="/editor" replace />} />
                <Route path="/auth-demo" element={<AuthDemo />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Main Editor (Public but enhanced for authenticated users) */}
                <Route path="/editor" element={<EditorPage />} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />

                <Route path="/subscriptions" element={
                  <ProtectedRoute>
                    <SubscriptionsPage />
                  </ProtectedRoute>
                } />

                <Route path="/payment/:planId" element={
                  <ProtectedRoute>
                    <PaymentPage />
                  </ProtectedRoute>
                } />

                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />

                {/* Admin Routes */}
                <Route path="/admin/*" element={
                  <AdminRoute>
                    <AdminPanel />
                  </AdminRoute>
                } />

                {/* Catch all route */}
                <Route path="*" element={<Navigate to="/editor" replace />} />
              </Routes>
            </Layout>
          </Router>
        </PaymentProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;