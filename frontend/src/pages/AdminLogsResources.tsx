import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { formatDate } from '../utils/dataTransformers';
import { LineChart, BarChart, StatsCard } from '../components/charts/ChartComponents';
import './AdminLogsResources.css';

interface SystemLog {
  id: number;
  level: string;
  category: string;
  message: string;
  details?: any;
  user_id?: number;
  ip_address?: string;
  created_at: string;
}

interface ResourceUsage {
  id: number;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_users: number;
  concurrent_executions: number;
  ai_requests_per_minute: number;
}

interface AuditLog {
  id: number;
  admin_user_id: number;
  action: string;
  target_type: string;
  target_id: number;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  created_at: string;
}

const AdminLogsResources: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'system-logs' | 'audit-logs' | 'resources'>('system-logs');
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    level: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    limit: 100
  });

  useEffect(() => {
    loadData();
  }, [activeTab, filters]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      switch (activeTab) {
        case 'system-logs':
          const systemLogsData = await adminService.getSystemLogs(filters);
          setSystemLogs(systemLogsData);
          break;
        case 'audit-logs':
          const auditLogsData = await adminService.getAuditLogs(filters);
          setAuditLogs(auditLogsData);
          break;
        case 'resources':
          const resourceData = await adminService.getResourceUsage();
          setResourceUsage(resourceData);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearLogs = async (logType: string) => {
    if (!window.confirm(`Are you sure you want to clear all ${logType}? This action cannot be undone.`)) {
      return;
    }

    try {
      await adminService.clearLogs(logType);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to clear logs');
    }
  };

  const exportLogs = async (logType: string) => {
    try {
      const data = await adminService.exportLogs(logType, filters);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${logType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export logs');
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      case 'critical': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const formatResourceUsage = (usage: number) => {
    return `${usage.toFixed(1)}%`;
  };

  return (
    <div className="admin-logs-resources">
      <div className="page-header">
        <h1>System Logs & Resources</h1>
        <p>Monitor system performance, logs, and audit trails</p>
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'system-logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('system-logs')}
          >
            System Logs
          </button>
          <button
            className={`tab ${activeTab === 'audit-logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit-logs')}
          >
            Audit Logs
          </button>
          <button
            className={`tab ${activeTab === 'resources' ? 'active' : ''}`}
            onClick={() => setActiveTab('resources')}
          >
            Resource Usage
          </button>
        </div>

        <div className="tab-actions">
          <button
            className="btn secondary"
            onClick={() => exportLogs(activeTab)}
          >
            Export
          </button>
          {activeTab !== 'resources' && (
            <button
              className="btn danger"
              onClick={() => clearLogs(activeTab)}
            >
              Clear Logs
            </button>
          )}
          <button
            className="btn primary"
            onClick={loadData}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters">
          {activeTab !== 'resources' && (
            <>
              <div className="filter-group">
                <label>Date From:</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>Date To:</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>Limit:</label>
                <select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="500">500</option>
                  <option value="1000">1000</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'system-logs' && (
            <>
              <div className="filter-group">
                <label>Level:</label>
                <select
                  value={filters.level}
                  onChange={(e) => handleFilterChange('level', e.target.value)}
                >
                  <option value="">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Category:</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="auth">Authentication</option>
                  <option value="payment">Payment</option>
                  <option value="execution">Code Execution</option>
                  <option value="ai_service">AI Service</option>
                  <option value="system">System</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="content-section">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'system-logs' && (
              <div className="system-logs-section">
                <div className="logs-table-container">
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Level</th>
                        <th>Category</th>
                        <th>Message</th>
                        <th>User</th>
                        <th>IP</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemLogs.map((log) => (
                        <tr key={log.id} className={`log-row log-${log.level.toLowerCase()}`}>
                          <td className="timestamp">
                            {formatDate(log.created_at)}
                          </td>
                          <td>
                            <span
                              className="log-level"
                              style={{ backgroundColor: getLogLevelColor(log.level) }}
                            >
                              {log.level.toUpperCase()}
                            </span>
                          </td>
                          <td className="category">{log.category}</td>
                          <td className="message">{log.message}</td>
                          <td>{log.user_id ? `User #${log.user_id}` : '-'}</td>
                          <td>{log.ip_address || '-'}</td>
                          <td>
                            {log.details && (
                              <button
                                className="btn-details"
                                onClick={() => alert(JSON.stringify(log.details, null, 2))}
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {systemLogs.length === 0 && (
                    <div className="no-data">No system logs found</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'audit-logs' && (
              <div className="audit-logs-section">
                <div className="logs-table-container">
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Admin</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Changes</th>
                        <th>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="audit-row">
                          <td className="timestamp">
                            {formatDate(log.created_at)}
                          </td>
                          <td>Admin #{log.admin_user_id}</td>
                          <td className="action">{log.action}</td>
                          <td>{log.target_type} #{log.target_id}</td>
                          <td>
                            {(log.old_values || log.new_values) && (
                              <button
                                className="btn-details"
                                onClick={() => {
                                  const changes = {
                                    old: log.old_values,
                                    new: log.new_values
                                  };
                                  alert(JSON.stringify(changes, null, 2));
                                }}
                              >
                                View Changes
                              </button>
                            )}
                          </td>
                          <td>{log.ip_address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditLogs.length === 0 && (
                    <div className="no-data">No audit logs found</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="resources-section">
                {resourceUsage.length > 0 && (
                  <>
                    <div className="resource-stats">
                      <StatsCard
                        title="CPU Usage"
                        value={formatResourceUsage(resourceUsage[resourceUsage.length - 1]?.cpu_usage || 0)}
                        icon="🖥️"
                        color="#3b82f6"
                      />
                      <StatsCard
                        title="Memory Usage"
                        value={formatResourceUsage(resourceUsage[resourceUsage.length - 1]?.memory_usage || 0)}
                        icon="💾"
                        color="#10b981"
                      />
                      <StatsCard
                        title="Disk Usage"
                        value={formatResourceUsage(resourceUsage[resourceUsage.length - 1]?.disk_usage || 0)}
                        icon="💿"
                        color="#f59e0b"
                      />
                      <StatsCard
                        title="Active Users"
                        value={resourceUsage[resourceUsage.length - 1]?.active_users || 0}
                        icon="👥"
                        color="#8b5cf6"
                      />
                    </div>

                    <div className="resource-charts">
                      <div className="chart-container">
                        <LineChart
                          data={{
                            labels: resourceUsage.slice(-24).map(r =>
                              new Date(r.timestamp).toLocaleTimeString()
                            ),
                            datasets: [
                              {
                                label: 'CPU Usage (%)',
                                data: resourceUsage.slice(-24).map(r => r.cpu_usage),
                                backgroundColor: '#3b82f6',
                                borderColor: '#3b82f6'
                              },
                              {
                                label: 'Memory Usage (%)',
                                data: resourceUsage.slice(-24).map(r => r.memory_usage),
                                backgroundColor: '#10b981',
                                borderColor: '#10b981'
                              }
                            ]
                          }}
                          title="System Resource Usage (Last 24 Hours)"
                          height={300}
                        />
                      </div>

                      <div className="chart-container">
                        <BarChart
                          data={{
                            labels: resourceUsage.slice(-12).map(r =>
                              new Date(r.timestamp).toLocaleTimeString()
                            ),
                            datasets: [{
                              label: 'Active Users',
                              data: resourceUsage.slice(-12).map(r => r.active_users),
                              backgroundColor: '#8b5cf6'
                            }]
                          }}
                          title="Active Users Over Time"
                          height={300}
                        />
                      </div>
                    </div>

                    <div className="resource-table-container">
                      <table className="resource-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>CPU</th>
                            <th>Memory</th>
                            <th>Disk</th>
                            <th>Active Users</th>
                            <th>Executions</th>
                            <th>AI Requests/min</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resourceUsage.slice(-20).reverse().map((resource) => (
                            <tr key={resource.id}>
                              <td>{formatDate(resource.timestamp)}</td>
                              <td>{formatResourceUsage(resource.cpu_usage)}</td>
                              <td>{formatResourceUsage(resource.memory_usage)}</td>
                              <td>{formatResourceUsage(resource.disk_usage)}</td>
                              <td>{resource.active_users}</td>
                              <td>{resource.concurrent_executions}</td>
                              <td>{resource.ai_requests_per_minute}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {resourceUsage.length === 0 && (
                  <div className="no-data">No resource usage data available</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminLogsResources;