import React, { Component, ErrorInfo, ReactNode } from 'react';
import './EditorErrorBoundary.css';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EditorErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report editor-specific error
    this.reportEditorError(error, errorInfo);
  }

  private reportEditorError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      type: 'editor_error',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      context: 'code_editor'
    };

    console.error('Editor Error Report:', errorReport);
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleFallbackEditor = () => {
    // In a real app, you might switch to a simpler text editor
    console.log('Switching to fallback editor mode');
    this.handleRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="editor-error-boundary">
          <div className="editor-error-content">
            <div className="error-icon">🔧</div>
            <h3>Editor Error</h3>
            <p className="error-message">
              The code editor encountered an unexpected error. This might be due to a syntax highlighting issue or editor configuration problem.
            </p>
            
            <div className="error-actions">
              <button className="retry-button" onClick={this.handleRetry}>
                Retry Editor
              </button>
              <button className="fallback-button" onClick={this.handleFallbackEditor}>
                Use Simple Editor
              </button>
            </div>

            <div className="error-suggestions">
              <h4>Possible solutions:</h4>
              <ul>
                <li>Try refreshing the page</li>
                <li>Switch to a different programming language</li>
                <li>Clear your browser cache</li>
                <li>Check if your browser supports modern JavaScript features</li>
              </ul>
            </div>

            <details className="error-details">
              <summary>Technical Details</summary>
              <div className="error-info">
                <div className="error-section">
                  <h4>Error:</h4>
                  <pre>{this.state.error?.message}</pre>
                </div>
                
                {this.state.error?.stack && (
                  <div className="error-section">
                    <h4>Stack Trace:</h4>
                    <pre className="error-stack">{this.state.error.stack}</pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EditorErrorBoundary;