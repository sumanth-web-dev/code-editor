import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getErrorMessage } from '../utils/errorUtils';
import './AIServiceMonitor.css';

interface APIKeyStatus {
  key_id: number;
  is_active: boolean;
  failure_count: number;
  last_failure: string | null;
  last_success: string | null;
  rate_limit_reset: string | null;
  total_requests: number;
  successful_requests: number;
  success_rate: number;
}

interface ProviderStatus {
  total_keys: number;
  active_keys: number;
  total_requests: number;
  successful_requests: number;
  success_rate: number;
  is_available: boolean;
  keys?: APIKeyStatus[];
  config: {
    name: string;
    priority: number;
    cost_per_token: number;
    max_tokens: number;
    is_enabled: boolean;
  };
}

interface AIStatus {
  providers: { [key: string]: ProviderStatus };
  cache_size: number;
  total_providers: number;
  available_providers: { [key: string]: boolean };
  configured_providers: string[];
}

const AIServiceMonitor: React.FC = () => {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await axios.get('/api/ai/status');
      if (response.data.success) {
        setStatus(response.data);
        setError(null);
      } else {
        setError(response.data.error || 'Failed to fetch AI status');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviderDetails = async (provider: string) => {
    try {
      const response = await axios.get(`/api/ai/providers/${provider}/status`);
      if (response.data.success && status) {
        setStatus(prev => ({
          ...prev!,
          providers: {
            ...prev!.providers,
            [provider]: response.data.status
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch details for ${provider}:`, err);
    }
  };

  const resetProvider = async (provider: string) => {
    try {
      const response = await axios.post(`/api/ai/providers/${provider}/reset`);
      if (response.data.success) {
        await fetchStatus();
        alert(`Successfully reset ${provider} API keys`);
      } else {
        alert(`Failed to reset ${provider}: ${response.data.error}`);
      }
    } catch (err: any) {
      alert(`Error resetting ${provider}: ${err.message}`);
    }
  };

  const toggleProvider = async (provider: string, enable: boolean) => {
    try {
      const endpoint = enable ? 'enable' : 'disable';
      const response = await axios.post(`/api/ai/providers/${provider}/${endpoint}`);
      if (response.data.success) {
        await fetchStatus();
      } else {
        alert(`Failed to ${endpoint} ${provider}: ${response.data.error}`);
      }
    } catch (err: any) {
      alert(`Error ${enable ? 'enabling' : 'disabling'} ${provider}: ${err.message}`);
    }
  };

  const clearCache = async () => {
    try {
      const response = await axios.post('/api/ai/cache/clear');
      if (response.data.success) {
        await fetchStatus();
        alert(`Cache cleared: ${response.data.cleared_entries} entries removed`);
      } else {
        alert(`Failed to clear cache: ${response.data.error}`);
      }
    } catch (err: any) {
      alert(`Error clearing cache: ${err.message}`);
    }
  };

  const testProvider = async (provider: string) => {
    try {
      const response = await axios.post(`/api/ai/test/${provider}`);
      if (response.data.success) {
        const result = response.data.test_result;
        alert(`Test ${result.success ? 'passed' : 'failed'} for ${provider}\n${result.success ? 'Provider is working correctly' : result.error}`);
      } else {
        alert(`Test failed for ${provider}: ${response.data.error}`);
      }
    } catch (err: any) {
      alert(`Error testing ${provider}: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (selectedProvider) {
      fetchProviderDetails(selectedProvider);
    }
  }, [selectedProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (isAvailable: boolean, successRate: number) => {
    if (!isAvailable) return '#dc3545'; // Red
    if (successRate >= 0.9) return '#28a745'; // Green
    if (successRate >= 0.7) return '#ffc107'; // Yellow
    return '#fd7e14'; // Orange
  };

  if (loading) {
    return (
      <div className="ai-monitor">
        <div className="monitor-header">
          <h2>AI Service Monitor</h2>
        </div>
        <div className="loading">Loading AI service status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-monitor">
        <div className="monitor-header">
          <h2>AI Service Monitor</h2>
          <button onClick={fetchStatus} className="refresh-btn">Retry</button>
        </div>
        <div className="error">Error: {getErrorMessage(error)}</div>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="ai-monitor">
      <div className="monitor-header">
        <h2>AI Service Monitor</h2>
        <div className="header-controls">
          <label className="auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={fetchStatus} className="refresh-btn">Refresh</button>
          <button onClick={clearCache} className="clear-cache-btn">Clear Cache</button>
        </div>
      </div>

      <div className="monitor-stats">
        <div className="stat-card">
          <h3>Total Providers</h3>
          <div className="stat-value">{status.total_providers}</div>
        </div>
        <div className="stat-card">
          <h3>Available Providers</h3>
          <div className="stat-value">{status.configured_providers.length}</div>
        </div>
        <div className="stat-card">
          <h3>Cache Size</h3>
          <div className="stat-value">{status.cache_size}</div>
        </div>
      </div>

      <div className="providers-grid">
        {Object.entries(status.providers).map(([provider, providerStatus]) => (
          <div key={provider} className="provider-card">
            <div className="provider-header">
              <h3>{provider.toUpperCase()}</h3>
              <div 
                className="status-indicator"
                style={{ backgroundColor: getStatusColor(providerStatus.is_available, providerStatus.success_rate) }}
              />
            </div>

            <div className="provider-stats">
              <div className="stat">
                <span className="label">Keys:</span>
                <span className="value">{providerStatus.active_keys}/{providerStatus.total_keys}</span>
              </div>
              <div className="stat">
                <span className="label">Success Rate:</span>
                <span className="value">{(providerStatus.success_rate * 100).toFixed(1)}%</span>
              </div>
              <div className="stat">
                <span className="label">Requests:</span>
                <span className="value">{providerStatus.total_requests}</span>
              </div>
              <div className="stat">
                <span className="label">Priority:</span>
                <span className="value">{providerStatus.config.priority}</span>
              </div>
            </div>

            <div className="provider-actions">
              <button 
                onClick={() => setSelectedProvider(selectedProvider === provider ? null : provider)}
                className="details-btn"
              >
                {selectedProvider === provider ? 'Hide Details' : 'Show Details'}
              </button>
              <button 
                onClick={() => testProvider(provider)}
                className="test-btn"
                disabled={!providerStatus.is_available}
              >
                Test
              </button>
              <button 
                onClick={() => toggleProvider(provider, !providerStatus.config.is_enabled)}
                className={`toggle-btn ${providerStatus.config.is_enabled ? 'disable' : 'enable'}`}
              >
                {providerStatus.config.is_enabled ? 'Disable' : 'Enable'}
              </button>
              <button 
                onClick={() => resetProvider(provider)}
                className="reset-btn"
                disabled={providerStatus.total_keys === 0}
              >
                Reset Keys
              </button>
            </div>

            {selectedProvider === provider && providerStatus.keys && (
              <div className="provider-details">
                <h4>API Keys Status</h4>
                <div className="keys-list">
                  {providerStatus.keys.map((key) => (
                    <div key={key.key_id} className={`key-item ${key.is_active ? 'active' : 'inactive'}`}>
                      <div className="key-header">
                        <span className="key-id">Key #{key.key_id}</span>
                        <span className={`key-status ${key.is_active ? 'active' : 'inactive'}`}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="key-stats">
                        <div className="key-stat">
                          <span>Failures:</span>
                          <span>{key.failure_count}</span>
                        </div>
                        <div className="key-stat">
                          <span>Success Rate:</span>
                          <span>{(key.success_rate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="key-stat">
                          <span>Last Success:</span>
                          <span>{formatDate(key.last_success)}</span>
                        </div>
                        <div className="key-stat">
                          <span>Last Failure:</span>
                          <span>{formatDate(key.last_failure)}</span>
                        </div>
                        {key.rate_limit_reset && (
                          <div className="key-stat">
                            <span>Rate Limit Reset:</span>
                            <span>{formatDate(key.rate_limit_reset)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIServiceMonitor;