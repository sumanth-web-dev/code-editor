import React, { useState, useEffect, useRef } from 'react';
import './ConsoleOutput.css';

export interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

interface ConsoleOutputProps {
  messages: ConsoleMessage[];
  onClear: () => void;
}

const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ messages, onClear }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isExpanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  // Auto-expand when there are error messages
  useEffect(() => {
    const hasErrors = messages.some(msg => msg.type === 'error');
    if (hasErrors && !isExpanded) {
      setIsExpanded(true);
    }
  }, [messages, isExpanded]);

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${timeString}.${milliseconds}`;
  };

  const errorCount = messages.filter(msg => msg.type === 'error').length;
  const warningCount = messages.filter(msg => msg.type === 'warn').length;

  return (
    <div className={`console-output ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="console-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="console-title">
          <span className="console-icon">🖥️</span>
          <span>Console</span>
          {messages.length > 0 && (
            <span className="message-count">
              ({messages.length} message{messages.length !== 1 ? 's' : ''})
            </span>
          )}
          {errorCount > 0 && (
            <span className="error-badge">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          )}
          {warningCount > 0 && (
            <span className="warning-badge">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        <div className="console-controls">
          {messages.length > 0 && (
            <button 
              className="clear-button" 
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Clear console"
            >
              Clear
            </button>
          )}
          <button className="toggle-button" title={isExpanded ? 'Collapse' : 'Expand'}>
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="console-messages">
          {messages.length === 0 ? (
            <div className="empty-console">
              <span>Console is empty. JavaScript output will appear here.</span>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className={`console-message ${message.type}`}>
                  <span className="message-icon">{getMessageIcon(message.type)}</span>
                  <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
                  <span className="message-text">{message.message}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ConsoleOutput;