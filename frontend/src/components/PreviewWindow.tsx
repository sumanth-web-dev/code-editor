import React, { useRef, useEffect, useState } from 'react';
import { PreviewWindowProps } from '../types';
import { getErrorMessage } from '../utils/errorUtils';
import ConsoleOutput, { ConsoleMessage } from './ConsoleOutput';
import './PreviewWindow.css';

const PreviewWindow: React.FC<PreviewWindowProps> = ({ html, css, javascript }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);

  useEffect(() => {
    updatePreview();
  }, [html, css, javascript]); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePreview = () => {
    if (!iframeRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (!iframeDoc) {
        setError('Unable to access preview window');
        setIsLoading(false);
        return;
      }

      // Create the complete HTML document
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Preview</title>
          <style>
            /* Reset styles for consistent preview */
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 8px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.4;
            }
            /* User CSS */
            ${css}
          </style>
        </head>
        <body>
          ${html}
          <script>
            // Override console methods to capture output
            window.consoleOutput = [];
            const originalConsole = {
              log: console.log,
              error: console.error,
              warn: console.warn,
              info: console.info
            };

            ['log', 'error', 'warn', 'info'].forEach(method => {
              console[method] = function(...args) {
                window.consoleOutput.push({
                  type: method,
                  message: args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                  ).join(' '),
                  timestamp: new Date().toISOString()
                });
                originalConsole[method].apply(console, args);
                
                // Notify parent window of console output
                window.parent.postMessage({
                  type: 'console',
                  method: method,
                  args: args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                  )
                }, '*');
              };
            });

            // Override window.onerror to catch JavaScript errors
            window.onerror = function(message, source, lineno, colno, error) {
              window.parent.postMessage({
                type: 'error',
                message: message,
                source: source,
                line: lineno,
                column: colno,
                error: error ? error.toString() : null
              }, '*');
              return false;
            };

            // Handle unhandled promise rejections
            window.addEventListener('unhandledrejection', function(event) {
              window.parent.postMessage({
                type: 'error',
                message: 'Unhandled Promise Rejection: ' + event.reason,
                source: 'Promise',
                line: 0,
                column: 0,
                error: event.reason ? event.reason.toString() : null
              }, '*');
            });

            try {
              // Execute user JavaScript
              ${javascript}
            } catch (error) {
              console.error('JavaScript execution error:', error);
              window.parent.postMessage({
                type: 'error',
                message: error.message,
                source: 'inline',
                line: 0,
                column: 0,
                error: error.toString()
              }, '*');
            }
          </script>
        </body>
        </html>
      `;

      // Write the HTML to the iframe
      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();

      setIsLoading(false);
    } catch (error: any) {
      console.error('Preview update error:', error);
      setError(error.message || 'Failed to update preview');
      setIsLoading(false);
    }
  };

  // Handle messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type, method, args, message, line } = event.data;

      if (type === 'console') {
        const consoleMessage: ConsoleMessage = {
          type: method as 'log' | 'error' | 'warn' | 'info',
          message: args.join(' '),
          timestamp: new Date().toISOString()
        };
        
        setConsoleMessages(prev => [...prev, consoleMessage]);
      } else if (type === 'error') {
        const errorMessage: ConsoleMessage = {
          type: 'error',
          message: line ? `Line ${line}: ${message}` : message,
          timestamp: new Date().toISOString()
        };
        
        setConsoleMessages(prev => [...prev, errorMessage]);
        setError(`JavaScript Error: ${message}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRefresh = () => {
    setConsoleMessages([]);
    setError(null);
    updatePreview();
  };

  const handleClearConsole = () => {
    setConsoleMessages([]);
  };

  return (
    <div className="preview-window">
      <div className="preview-header">
        <h3>Live Preview</h3>
        <div className="preview-controls">
          <button 
            className="refresh-button" 
            onClick={handleRefresh}
            title="Refresh preview"
          >
            ↻
          </button>
        </div>
      </div>
      
      <div className="preview-content">
        {isLoading && (
          <div className="preview-loading">
            <div className="loading-spinner"></div>
            <span>Updating preview...</span>
          </div>
        )}
        
        {error && (
          <div className="preview-error">
            <div className="error-icon">⚠️</div>
            <div className="error-message">{getErrorMessage(error)}</div>
            <button className="retry-button" onClick={handleRefresh}>
              Retry
            </button>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          className="preview-iframe"
          title="Live Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          style={{ display: error ? 'none' : 'block' }}
        />
      </div>
      
      <ConsoleOutput 
        messages={consoleMessages}
        onClear={handleClearConsole}
      />
    </div>
  );
};

export default PreviewWindow;