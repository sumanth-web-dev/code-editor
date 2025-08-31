import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePayments } from '../hooks/usePayments';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { subscription, paymentHistory } = usePayments();

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.name}!</h1>
        <p className="dashboard-subtitle">Here's your account overview</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Account Status</h3>
          <div className="status-info">
            <div className="status-item">
              <span className="label">Plan:</span>
              <span className={`value ${subscription?.plan || 'free'}`}>
                {subscription?.plan?.name || 'Free'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">Status:</span>
              <span className={`value ${subscription?.status || 'inactive'}`}>
                {subscription?.status || 'No active subscription'}
              </span>
            </div>
            {subscription?.end_date && (
              <div className="status-item">
                <span className="label">Expires:</span>
                <span className="value">
                  {subscription.end_date}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <button className="action-btn primary" onClick={() => window.location.href = '/editor'}>
              Create New Document
            </button>
            <button className="action-btn secondary" onClick={() => window.location.href = '/subscriptions'}>
              Manage Subscription
            </button>
            <button className="action-btn secondary" onClick={() => window.location.href = '/profile'}>
              Edit Profile
            </button>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Payment History</h3>
          <div className="payment-history-list">
            {paymentHistory.length === 0 ? (
              <div>No payment history found.</div>
            ) : (
              <ul>
                {paymentHistory.map((payment: any) => (
                  <li key={payment.id}>
                    {payment.date} - ₹{payment.amount} INR - {payment.status}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Usage Information</h3>
          <div className="usage-info">
            {subscription?.plan ? (
              <div>
                <p>Plan: {subscription.plan.name}</p>
                <p>Status: {subscription.status}</p>
                {subscription.end_date && (
                  <p>Valid until: {subscription.end_date}</p>
                )}
              </div>
            ) : (
              <p>No active subscription. Consider upgrading for premium features.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;