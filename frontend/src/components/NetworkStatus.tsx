import React, { useState, useEffect } from 'react';
import { getNetworkDiagnostics } from '../utils/networkUtils';
import './NetworkStatus.css';

interface NetworkStatusProps {
  onRetry?: () => void;
  showDiagnostics?: boolean;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ onRetry, showDiagnostics = false }) => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(showDiagnostics);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const results = await getNetworkDiagnostics();
      setDiagnostics(results);
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showDiagnostics) {
      runDiagnostics();
    }
  }, [showDiagnostics]);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="network-status">
      <div className="network-status-header">
        <h3>🔌 Connection Issue Detected</h3>
        <p>We're having trouble connecting to the server. Here's what you can try:</p>
      </div>

      <div className="network-status-actions">
        <button onClick={handleRetry} className="retry-btn">
          🔄 Try Again
        </button>
        <button onClick={() => setShowDetails(!showDetails)} className="diagnostics-btn">
          🔍 {showDetails ? 'Hide' : 'Show'} Diagnostics
        </button>
        <button onClick={runDiagnostics} disabled={loading} className="test-btn">
          {loading ? '⏳ Testing...' : '🧪 Test Connection'}
        </button>
      </div>

      {showDetails && (
        <div className="network-diagnostics">
          <h4>Network Diagnostics</h4>
          
          {diagnostics ? (
            <div className="diagnostics-results">
              <div className="diagnostic-section">
                <h5>📡 Connection Status</h5>
                <ul>
                  <li>Online: {diagnostics.online ? '✅ Yes' : '❌ No'}</li>
                  <li>Backend: {diagnostics.backend.isConnected ? '✅ Connected' : '❌ Disconnected'}</li>
                  <li>Login Endpoint: {diagnostics.auth.loginEndpoint ? '✅ Available' : '❌ Unavailable'}</li>
                  <li>Register Endpoint: {diagnostics.auth.registerEndpoint ? '✅ Available' : '❌ Unavailable'}</li>
                </ul>
              </div>

              <div className="diagnostic-section">
                <h5>⚙️ Configuration</h5>
                <ul>
                  <li>API URL: <code>{diagnostics.apiBaseUrl}</code></li>
                  <li>Environment: <code>{diagnostics.environment}</code></li>
                </ul>
              </div>

              {diagnostics.backend.error && (
                <div className="diagnostic-section error">
                  <h5>❌ Backend Error</h5>
                  <p>{diagnostics.backend.error}</p>
                </div>
              )}

              {diagnostics.auth.errors.length > 0 && (
                <div className="diagnostic-section error">
                  <h5>❌ Auth Errors</h5>
                  <ul>
                    {diagnostics.auth.errors.map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="diagnostic-section recommendations">
                <h5>💡 Recommendations</h5>
                <ul>
                  {diagnostics.recommendations.map((rec: string, index: number) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p>Click "Test Connection" to run diagnostics</p>
          )}
        </div>
      )}


    </div>
  );
};

export default NetworkStatus;