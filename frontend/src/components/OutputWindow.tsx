import React from 'react';
import { OutputWindowProps } from '../types';
import { getErrorMessage } from '../utils/errorUtils';
import LoadingSpinner from './LoadingSpinner';
import './OutputWindow.css';

const OutputWindow: React.FC<OutputWindowProps> = ({ output, isLoading, error }) => {
  return (
    <div className="output-window">
      <div className="output-header">
        <h3>Output</h3>
        {isLoading && (
          <div className="loading-indicator-small">
            <div className="spinner"></div>
            <span>Executing...</span>
          </div>
        )}
      </div>
      
      <div className="output-content">
        {isLoading && (
          <LoadingSpinner 
            type="execution" 
            message="Executing your code..." 
            size="medium"
          />
        )}
        
        {error && (
          <div className="error-output">
            <div className="error-header">
              <svg className="error-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <strong>Execution Error</strong>
            </div>
            <div className="error-message">
              {getErrorMessage(error)}
            </div>
          </div>
        )}
        
        {output && !isLoading && (
          <div className="code-output-container">
            <div className="output-toolbar">
              <span className="output-label">Output:</span>
              <button 
                className="copy-button"
                onClick={() => navigator.clipboard.writeText(output)}
                title="Copy output to clipboard"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                Copy
              </button>
            </div>
            <pre className="code-output">{output}</pre>
          </div>
        )}
        
        {!isLoading && !error && !output && (
          <div className="no-output">
            <div className="no-output-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zM4 19V7h16v12H4z"/>
              </svg>
            </div>
            <p>No output yet</p>
            <span className="no-output-hint">Run your code to see results here</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputWindow;