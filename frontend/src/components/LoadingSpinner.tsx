import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
  type?: 'execution' | 'connection' | 'loading' | 'analysis';
  size?: 'small' | 'medium' | 'large';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message,
  type = 'loading',
  size = 'medium'
}) => {
  const getDefaultMessage = (type: string): string => {
    const messages = {
      execution: 'Executing your code...',
      connection: 'Connecting to server...',
      loading: 'Loading...',
      analysis: 'Analyzing code...'
    };
    return messages[type as keyof typeof messages] || 'Loading...';
  };

  const displayMessage = message || getDefaultMessage(type);

  return (
    <div className={`loading-spinner-container ${size}`}>
      <div className={`loading-spinner ${type}`}>
        <div className="spinner-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
      <p className="loading-message">{displayMessage}</p>
    </div>
  );
};

export default LoadingSpinner;