import { ErrorInfo } from 'react';

export interface ErrorReport {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  context?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  metadata?: Record<string, any>;
}

class ErrorLogger {
  private sessionId: string;
  private userId?: string;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event: any) => {
      let message = '';
      if (event.message) {
        message = event.message;
      } else if (event.type === 'error' && event.target) {
        // Resource loading error (e.g., <img>, <script>)
        message = `Resource error: ${event.target?.src || event.target?.href || event.target?.outerHTML}`;
      } else {
        message = `Unknown error event: ${JSON.stringify(event)}`;
      }
      this.logError({
        message,
        stack: event.error?.stack,
        context: 'global_error',
        severity: 'high',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          type: event.type,
          target: event.target?.outerHTML
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: 'unhandled_promise',
        severity: 'high',
        metadata: {
          reason: event.reason
        }
      });
    });
  }

  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public logError(errorData: {
    message: string;
    stack?: string;
    componentStack?: string;
    context?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    metadata?: Record<string, any>;
  }): void {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: errorData.message,
      stack: errorData.stack,
      componentStack: errorData.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.userId,
      sessionId: this.sessionId,
      context: errorData.context,
      severity: errorData.severity || 'medium',
      tags: errorData.tags || [],
      metadata: errorData.metadata || {}
    };

    this.addToQueue(errorReport);
    this.logToConsole(errorReport);
    
    // In a real application, you would send this to your error reporting service
    this.sendToErrorService(errorReport);
  }

  public logReactError(error: Error, errorInfo: ErrorInfo, context?: string): void {
    this.logError({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
      context: context || 'react_error',
      severity: 'high',
      tags: ['react', 'component'],
      metadata: {
        errorName: error.name,
        componentStack: errorInfo.componentStack || undefined
      }
    });
  }

  public logApiError(error: any, endpoint: string, method: string): void {
    this.logError({
      message: `API Error: ${error.message || 'Unknown error'}`,
      stack: error.stack,
      context: 'api_error',
      severity: 'medium',
      tags: ['api', method.toLowerCase()],
      metadata: {
        endpoint,
        method,
        status: error.status,
        statusText: error.statusText,
        response: error.response
      }
    });
  }

  public logUserAction(action: string, metadata?: Record<string, any>): void {
    this.logError({
      message: `User Action: ${action}`,
      context: 'user_action',
      severity: 'low',
      tags: ['user_action'],
      metadata: metadata || {}
    });
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToQueue(errorReport: ErrorReport): void {
    this.errorQueue.push(errorReport);
    
    // Keep queue size manageable
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  private logToConsole(errorReport: ErrorReport): void {
    const logMethod = this.getConsoleMethod(errorReport.severity);
    
    console.group(`🚨 Error Report [${errorReport.severity.toUpperCase()}]`);
    console[logMethod]('Message:', errorReport.message);
    console.log('ID:', errorReport.id);
    console.log('Timestamp:', errorReport.timestamp);
    console.log('Context:', errorReport.context);
    console.log('Session ID:', errorReport.sessionId);
    
    if (errorReport.stack) {
      console.log('Stack Trace:', errorReport.stack);
    }
    
    if (errorReport.componentStack) {
      console.log('Component Stack:', errorReport.componentStack);
    }
    
    if (errorReport.metadata && Object.keys(errorReport.metadata).length > 0) {
      console.log('Metadata:', errorReport.metadata);
    }
    
    console.groupEnd();
  }

  private getConsoleMethod(severity: string): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'low':
        return 'log';
      case 'medium':
        return 'warn';
      case 'high':
      case 'critical':
        return 'error';
      default:
        return 'log';
    }
  }

  private async sendToErrorService(errorReport: ErrorReport): Promise<void> {
    try {
      // In a real application, you would send this to your error reporting service
      // Examples: Sentry, LogRocket, Bugsnag, etc.
      
      // For now, we'll just simulate the API call
      console.log('📤 Sending error report to service:', errorReport.id);
      
      // Example API call:
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(errorReport)
      // });
      
      // Store in localStorage as a fallback for demo purposes
      this.storeInLocalStorage(errorReport);
      
    } catch (error) {
      console.error('Failed to send error report:', error);
      // Store locally if remote logging fails
      this.storeInLocalStorage(errorReport);
    }
  }

  private storeInLocalStorage(errorReport: ErrorReport): void {
    try {
      const existingErrors = this.getStoredErrors();
      existingErrors.push(errorReport);
      
      // Keep only the last 20 errors in localStorage
      const recentErrors = existingErrors.slice(-20);
      
      localStorage.setItem('error_reports', JSON.stringify(recentErrors));
    } catch (error) {
      console.error('Failed to store error in localStorage:', error);
    }
  }

  public getStoredErrors(): ErrorReport[] {
    try {
      const stored = localStorage.getItem('error_reports');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve stored errors:', error);
      return [];
    }
  }

  public clearStoredErrors(): void {
    try {
      localStorage.removeItem('error_reports');
    } catch (error) {
      console.error('Failed to clear stored errors:', error);
    }
  }

  public getErrorStats(): {
    totalErrors: number;
    errorsBySeverity: Record<string, number>;
    errorsByContext: Record<string, number>;
    recentErrors: ErrorReport[];
  } {
    const errors = this.getStoredErrors();
    
    const errorsBySeverity = errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const errorsByContext = errors.reduce((acc, error) => {
      const context = error.context || 'unknown';
      acc[context] = (acc[context] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalErrors: errors.length,
      errorsBySeverity,
      errorsByContext,
      recentErrors: errors.slice(-10)
    };
  }
}

// Create a singleton instance
const errorLogger = new ErrorLogger();

export default errorLogger;