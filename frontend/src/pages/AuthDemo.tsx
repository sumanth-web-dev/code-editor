import React from 'react';
import { Link } from 'react-router-dom';
import './AuthPages.css';

const AuthDemo: React.FC = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: 'white'
          }}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '40px', height: '40px' }}>
              <path d="M13.325 3.05011L8.66741 20.4323L10.5993 20.9499L15.2568 3.56775L13.325 3.05011Z" fill="currentColor"/>
              <path d="M7.61197 18.3608L8.97136 16.9124L8.97086 16.912L2.39037 10.5392C2.00581 10.1684 2.00581 9.56991 2.39037 9.19911L8.97086 2.82629L7.61197 1.37787L1.03148 7.75069C-0.343826 9.08682 -0.343826 11.1515 1.03148 12.4876L7.61197 18.8604V18.3608Z" fill="currentColor"/>
              <path d="M16.388 18.3608L15.0286 16.9124L15.0291 16.912L21.6096 10.5392C21.9942 10.1684 21.9942 9.56991 21.6096 9.19911L15.0291 2.82629L16.388 1.37787L22.9685 7.75069C24.3438 9.08682 24.3438 11.1515 22.9685 12.4876L16.388 18.8604V18.3608Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: '#1a202c', 
            margin: '0 0 16px 0' 
          }}>
            Minimal One-Line Auth
          </h1>
          <p style={{ 
            fontSize: '18px', 
            color: '#718096', 
            margin: '0 0 32px 0' 
          }}>
            Ultra-minimal terminal-style authentication with everything in one line.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <Link 
            to="/login" 
            style={{
              flex: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '16px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            View Sign In
          </Link>
          <Link 
            to="/register" 
            style={{
              flex: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 24px',
              background: '#f8fafc',
              color: '#374151',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              fontSize: '16px',
              border: '2px solid #e5e7eb',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            View Sign Up
          </Link>
        </div>

        <div style={{ 
          background: '#f8fafc', 
          borderRadius: '12px', 
          padding: '24px',
          textAlign: 'left'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1a202c', 
            margin: '0 0 16px 0' 
          }}>
            ✨ Authentication Features:
          </h3>
          <ul style={{ 
            margin: '0', 
            paddingLeft: '20px', 
            color: '#4a5568',
            lineHeight: '1.6'
          }}>
            <li>Secure user authentication</li>
            <li>Clean and minimal design</li>
            <li>Responsive layout</li>
            <li>Password security features</li>
            <li>Fast and reliable</li>
          </ul>
        </div>

        <div style={{ marginTop: '24px' }}>
          <Link 
            to="/editor" 
            style={{
              color: '#667eea',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ← Back to Editor
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AuthDemo;