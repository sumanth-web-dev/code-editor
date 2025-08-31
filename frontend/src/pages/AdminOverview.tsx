import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminOverview.css';

const AdminOverview: React.FC = () => {
  const [distribution, setDistribution] = useState<any>({});
  const [methods, setMethods] = useState<any>({});
  const [status, setStatus] = useState<any>({});
  const [activity, setActivity] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get('/api/admin/plan-distribution').then(res => setDistribution(res.data.distribution)).catch(() => setError('Failed to load plan distribution'));
    axios.get('/api/admin/payment-methods').then(res => setMethods(res.data.methods)).catch(() => setError('Failed to load payment methods'));
    axios.get('/api/admin/subscription-status').then(res => setStatus(res.data.status)).catch(() => setError('Failed to load subscription status'));
    axios.get('/api/admin/recent-activity').then(res => setActivity(res.data.activity)).catch(() => setError('Failed to load recent activity'));
  }, []);

  return (
    <div className="admin-overview-container">
      <h2>Admin Dashboard Overview</h2>
      {error && <div className="error-message">{error}</div>}
      <div className="overview-cards">
        <div className="card plan-distribution">
          <h3>📊 Plan Distribution</h3>
          <ul>
            {Object.entries(distribution).map(([plan, count]) => (
              <li key={plan}>{plan}: <strong>{String(count)}</strong></li>
            ))}
          </ul>
        </div>
        <div className="card payment-methods">
          <h3>💳 Payment Methods</h3>
          <ul>
            {Object.entries(methods).map(([method, count]) => (
              <li key={method}>{method}: <strong>{String(count)}</strong></li>
            ))}
          </ul>
        </div>
        <div className="card subscription-status">
          <h3>📈 Subscription Status</h3>
          <ul>
            {Object.entries(status).map(([stat, count]) => (
              <li key={stat}>{stat}: <strong>{String(count)}</strong></li>
            ))}
          </ul>
        </div>
        <div className="card recent-activity">
          <h3>🔔 Recent Activity</h3>
          <ul>
            {activity.map((item, idx) => (
              <li key={idx}>
                {item.description} 
                <span className="timestamp">{item.timestamp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
