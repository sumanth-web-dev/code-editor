import React, { useState } from 'react';
import './DemoCredentials.css';

const DemoCredentials: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const demoAccounts = [
    {
      type: 'Admin',
      email: 'admin@codeplatform.com',
      password: 'admin123',
      description: 'Full admin access with plan management',
      color: '#ef4444'
    },
    {
      type: 'User',
      email: 'user@demo.com',
      password: 'user123',
      description: 'Regular user account for testing subscriptions',
      color: '#3b82f6'
    }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    });
  };

  return (
    <div className="demo-credentials">
      <button 
        className="demo-toggle"
        onClick={() => setIsVisible(!isVisible)}
        type="button"
      >
        🎭 Demo Credentials
      </button>
      
      {isVisible && (
        <div className="demo-panel">
          <div className="demo-header">
            <h3>Demo Accounts</h3>
            <p>Use these credentials to test the platform</p>
          </div>
          
          {demoAccounts.map((account, index) => (
            <div key={index} className="demo-account" style={{ borderLeftColor: account.color }}>
              <div className="account-header">
                <span className="account-type" style={{ backgroundColor: account.color }}>
                  {account.type}
                </span>
                <span className="account-description">{account.description}</span>
              </div>
              
              <div className="credentials">
                <div className="credential-item">
                  <label>Email:</label>
                  <div className="credential-value">
                    <span>{account.email}</span>
                    <button 
                      onClick={() => copyToClipboard(account.email)}
                      className="copy-btn"
                      type="button"
                      title="Copy email"
                    >
                      {copiedText === account.email ? '✅' : '📋'}
                    </button>
                  </div>
                </div>
                
                <div className="credential-item">
                  <label>Password:</label>
                  <div className="credential-value">
                    <span>{account.password}</span>
                    <button 
                      onClick={() => copyToClipboard(account.password)}
                      className="copy-btn"
                      type="button"
                      title="Copy password"
                    >
                      {copiedText === account.password ? '✅' : '📋'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <div className="demo-footer">
            <p>💡 <strong>Admin Account:</strong> Access admin panel at <code>/admin</code></p>
            <p>👤 <strong>User Account:</strong> Test subscription and payment flow</p>
          </div>
        </div>
      )}
      

    </div>
  );
};

export default DemoCredentials;