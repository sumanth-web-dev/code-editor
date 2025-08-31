import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class PaymentErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Payment Error Boundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#fee2e2',
          color: '#991b1b',
          borderRadius: '8px',
          border: '1px solid #fecaca',
          margin: '1rem'
        }}>
          <h2>Payment System Error</h2>
          <p>There was an error loading the payment system. This might be because:</p>
          <ul style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
            <li>The backend server is not running</li>
            <li>There's a network connectivity issue</li>
            <li>The payment service is temporarily unavailable</li>
          </ul>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Try Again
          </button>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            <details>
              <summary>Error Details</summary>
              <pre style={{ textAlign: 'left', background: '#f8f9fa', padding: '1rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                {this.state.error?.message || 'Unknown error'}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PaymentErrorBoundary;