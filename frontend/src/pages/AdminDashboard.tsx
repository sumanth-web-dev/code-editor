import React, { useState, useEffect } from 'react';
import { useAdmin } from '../hooks/useAdmin';
import { formatDate } from '../utils/dataTransformers';
import { adminService } from '../services/adminService';
import { SubscriptionPlan, Payment, UserSubscription } from '../types';
import { getErrorMessage } from '../utils/errorUtils';
import { 
  LineChart, 
  BarChart, 
  PieChart, 
  DonutChart, 
  StatsCard, 
  ActivityTimeline 
} from '../components/charts/ChartComponents';
import './AdminDashboard.css';

// Helper function to format currency in INR
const formatINR = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

const AdminDashboard: React.FC = () => {
  const {
    stats,
    users,
    subscriptions,
    loading,
    error,
    searchUsers,
    updateUserRole,
    deleteUser
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'subscriptions' | 'payments' | 'plans' | 'analytics'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<UserSubscription | null>(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extendReason, setExtendReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<number | undefined>();
  const [refundReason, setRefundReason] = useState('');
  const [revenueAnalytics, setRevenueAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planFormData, setPlanFormData] = useState({
    name: '',
    description: '',
    price: 0,
    interval: 'month',
    executionLimit: 100,
    storageLimit: 1024,
    aiAnalysisLimit: 10,
    features: [''],
    is_active: true
  });

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      try {
        await searchUsers(searchQuery);
      } catch (error) {
        console.error('Search failed:', error);
      }
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: 'student' | 'editor' | 'admin') => {
    try {
      await updateUserRole(userId, newRole);
      alert('User role updated successfully');
    } catch (error) {
      console.error('Role update failed:', error);
      alert('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser(userId);
        alert('User deleted successfully');
      } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete user');
      }
    }
  };

  // Load additional data
  useEffect(() => {
    const loadAdditionalData = async () => {
      try {
        if (activeTab === 'plans') {
          const plansData = await adminService.getAdminPlans();
          setPlans(plansData);
        }
        if (activeTab === 'payments') {
          const paymentsData = await adminService.getPayments(1, 50);
          setPayments(paymentsData.payments || []);
        }
      } catch (error) {
        console.error('Failed to load additional data:', error);
        // Set empty arrays on error to prevent crashes
        if (activeTab === 'plans') {
          setPlans([]);
        }
        if (activeTab === 'payments') {
          setPayments([]);
        }
      }
    };

    if (activeTab === 'plans' || activeTab === 'payments') {
      loadAdditionalData();
    }
  }, [activeTab]);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      if (activeTab === 'analytics') {
        setAnalyticsLoading(true);
        try {
          const analyticsData = await adminService.getDashboardAnalytics();
          setRevenueAnalytics(analyticsData);
        } catch (error) {
          console.error('Failed to load analytics:', error);
        } finally {
          setAnalyticsLoading(false);
        }
      }
    };

    loadAnalytics();
  }, [activeTab]);

  const handleExtendSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      await adminService.extendSubscription(selectedSubscription.id, extendDays, extendReason);
      alert('Subscription extended successfully');
      setShowExtendModal(false);
      setSelectedSubscription(null);
      setExtendDays(30);
      setExtendReason('');
      // Refresh subscriptions data
      window.location.reload();
    } catch (error) {
      console.error('Failed to extend subscription:', error);
      alert('Failed to extend subscription');
    }
  };

  const handleCancelSubscription = async (subscription: UserSubscription) => {
    const reason = prompt('Enter cancellation reason (optional):');
    if (reason === null) return; // User cancelled

    try {
      await adminService.cancelSubscription(subscription.id, reason || 'Cancelled by admin');
      alert('Subscription cancelled successfully');
      // Refresh subscriptions data
      window.location.reload();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription');
    }
  };

  const handleProcessRefund = async () => {
    if (!selectedPayment) return;

    try {
      await adminService.processRefund(selectedPayment.id, refundAmount, refundReason);
      alert('Refund processed successfully');
      setShowRefundModal(false);
      setSelectedPayment(null);
      setRefundAmount(undefined);
      setRefundReason('');
      // Refresh payments data
      window.location.reload();
    } catch (error) {
      console.error('Failed to process refund:', error);
      alert('Failed to process refund');
    }
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setPlanFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      interval: plan.interval,
      executionLimit: plan.executionLimit || 0,
      storageLimit: plan.storageLimit || 0,
      aiAnalysisLimit: plan.aiAnalysisLimit || 10,
      features: plan.features.length > 0 ? plan.features : [''],
      is_active: plan.is_active || true
    });
    setEditingPlan(plan);
    setShowCreatePlanModal(true);
  };

  const handleTogglePlanStatus = async (plan: SubscriptionPlan) => {
    try {
      await adminService.togglePlanStatus(typeof plan.id === 'string' ? parseInt(plan.id) : plan.id);
      alert(`Plan ${plan.is_active ? 'deactivated' : 'activated'} successfully`);
      // Refresh plans data
      const plansData = await adminService.getAdminPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to toggle plan status:', error);
      alert('Failed to update plan status');
    }
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    if (!window.confirm(`Are you sure you want to delete the "${plan.name}" plan?`)) {
      return;
    }

    try {
      await adminService.deletePlan(typeof plan.id === 'string' ? parseInt(plan.id) : plan.id);
      alert('Plan deleted successfully');
      // Refresh plans data
      const plansData = await adminService.getAdminPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to delete plan:', error);
      alert('Failed to delete plan');
    }
  };

  const handleSavePlan = async () => {
    try {
      const planData = {
        ...planFormData,
        features: planFormData.features.filter(f => f.trim() !== '')
      };

      if (editingPlan) {
        await adminService.updatePlan(typeof editingPlan.id === 'string' ? parseInt(editingPlan.id) : editingPlan.id, planData);
        alert('Plan updated successfully');
      } else {
        await adminService.createPlan(planData);
        alert('Plan created successfully');
      }

      setShowCreatePlanModal(false);
      setEditingPlan(null);
      setPlanFormData({
        name: '',
        description: '',
        price: 0,
        interval: 'month',
        executionLimit: 100,
        storageLimit: 1024,
        aiAnalysisLimit: 10,
        features: [''],
        is_active: true
      });

      // Refresh plans data
      const plansData = await adminService.getAdminPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Failed to save plan');
    }
  };

  const addFeature = () => {
    setPlanFormData({
      ...planFormData,
      features: [...planFormData.features, '']
    });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...planFormData.features];
    newFeatures[index] = value;
    setPlanFormData({
      ...planFormData,
      features: newFeatures
    });
  };

  const removeFeature = (index: number) => {
    const newFeatures = planFormData.features.filter((_, i) => i !== index);
    setPlanFormData({
      ...planFormData,
      features: newFeatures.length > 0 ? newFeatures : ['']
    });
  };

  if (loading) {
    return (
      <div className="admin-loading" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '1rem'
      }}>
        <div className="loading-shimmer" style={{
          width: '300px',
          height: '20px',
          borderRadius: '10px'
        }}></div>
        <div className="loading-shimmer" style={{
          width: '200px',
          height: '20px',
          borderRadius: '10px'
        }}></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Loading admin dashboard...</p>
      </div>
    );
  }

  if (error) {
    return <div className="admin-error">Error: {getErrorMessage(error)}</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Manage users, subscriptions, and monitor system performance</p>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          Subscriptions
        </button>
        <button
          className={`tab ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          Payments
        </button>
        <button
          className={`tab ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          Plans
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            {/* Enhanced Stats Cards with Charts */}
            <div className="stats-grid">
              <StatsCard
                title="Total Users"
                value={stats?.total_users || 0}
                change={{
                  value: stats?.new_users_today || 0,
                  type: 'increase',
                  period: 'new today'
                }}
                icon="👥"
                color="#3b82f6"
              />
              <StatsCard
                title="Active Subscriptions"
                value={stats?.active_subscriptions || 0}
                change={{
                  value: stats?.new_subscriptions_today || 0,
                  type: 'increase',
                  period: 'new today'
                }}
                icon="📋"
                color="#10b981"
              />
              <StatsCard
                title="Monthly Revenue"
                value={`₹${(stats?.monthly_revenue || 0).toLocaleString('en-IN')}`}
                change={{
                  value: stats?.revenue_today || 0,
                  type: 'increase',
                  period: 'today'
                }}
                icon="💰"
                color="#f59e0b"
              />
              <StatsCard
                title="Total Revenue"
                value={`₹${(stats?.total_revenue || 0).toLocaleString('en-IN')}`}
                change={{
                  value: Math.round((stats?.monthly_revenue || 0) / (stats?.total_revenue || 1) * 100),
                  type: 'increase',
                  period: 'monthly %'
                }}
                icon="📈"
                color="#8b5cf6"
              />
            </div>

            {/* Charts Section */}
            <div className="charts-section">
              <div className="charts-row">
                <div className="chart-half">
                  <LineChart
                    data={{
                      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                      datasets: [{
                        label: 'Revenue (₹)',
                        data: [
                          stats?.monthly_revenue || 0,
                          (stats?.monthly_revenue || 0) * 0.8,
                          (stats?.monthly_revenue || 0) * 1.2,
                          (stats?.monthly_revenue || 0) * 0.9,
                          (stats?.monthly_revenue || 0) * 1.1,
                          stats?.monthly_revenue || 0
                        ],
                        backgroundColor: '#3b82f6',
                        borderColor: '#3b82f6'
                      }]
                    }}
                    title="Revenue Trend (6 Months)"
                    height={250}
                  />
                </div>
                <div className="chart-half">
                  <BarChart
                    data={{
                      labels: stats?.top_plans?.map(plan => plan.plan_name) || ['Basic', 'Premium', 'Annual'],
                      datasets: [{
                        label: 'Subscribers',
                        data: stats?.top_plans?.map(plan => plan.subscribers) || [0, 0, 0],
                        backgroundColor: '#10b981'
                      }]
                    }}
                    title="Plan Distribution"
                    height={250}
                  />
                </div>
              </div>
              
              <div className="charts-row">
                <div className="chart-half">
                  <PieChart
                    data={{
                      labels: ['Stripe', 'Razorpay', 'PayPal'],
                      values: [65, 25, 10],
                      colors: ['#3b82f6', '#f59e0b', '#10b981']
                    }}
                    title="Payment Methods"
                  />
                </div>
                <div className="chart-half">
                  <DonutChart
                    data={{
                      labels: ['Active', 'Expired', 'Cancelled'],
                      values: [
                        stats?.active_subscriptions || 0,
                        Math.max(0, (stats?.total_users || 0) - (stats?.active_subscriptions || 0)),
                        0
                      ],
                      colors: ['#10b981', '#f59e0b', '#ef4444']
                    }}
                    title="Subscription Status"
                    centerText={`${stats?.active_subscriptions || 0} Total`}
                  />
                </div>
              </div>
            </div>

            {/* Enhanced Activity Timeline */}
            <ActivityTimeline
              activities={stats?.recent_activity?.map((activity, index) => ({
                id: index.toString(),
                type: (activity.type === 'new_user' ? 'user' : 
                       activity.type === 'payment' ? 'payment' : 
                       activity.type === 'subscription' ? 'subscription' : 'system') as 'user' | 'payment' | 'subscription' | 'system',
                title: activity.type === 'new_user' ? 'New User Registration' : 
                       activity.type === 'payment' ? 'Payment Completed' : 
                       activity.type === 'subscription' ? 'New Subscription' : 'System Activity',
                description: activity.message || 'No description available',
                timestamp: activity.timestamp || new Date().toISOString(),
                user: 'System'
              })) || [
                {
                  id: '1',
                  type: 'system' as const,
                  title: 'System Ready',
                  description: 'Admin dashboard loaded successfully',
                  timestamp: new Date().toISOString(),
                  user: 'System'
                }
              ]}
              title="Recent Activity"
            />
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <div className="users-header">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button onClick={handleSearch}>Search</button>
              </div>
            </div>

            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Plans</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name || `${user.first_name} ${user.last_name}`}</td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleUpdate(user.id, e.target.value as 'student' | 'editor' | 'admin')}
                        >
                          <option value="student">Student</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className={`status ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="user-plans">
                          {user.plans && user.plans.length > 0 ? (
                            user.plans.map((plan: any, index: number) => (
                              <div key={index} className="plan-badge">
                                <span className={`plan-name ${plan.status}`}>
                                  {plan.name}
                                </span>
                                <span className="plan-status">({plan.status})</span>
                              </div>
                            ))
                          ) : (
                            <span className="no-plans">No active plans</span>
                          )}
                        </div>
                      </td>
                      <td>{user.created_at ? formatDate(user.created_at) : 'N/A'}</td>
                      <td>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="subscriptions-section">
            <h3>Subscription Management</h3>
            <div className="subscriptions-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td>User #{subscription.user_id}</td>
                      <td>{subscription.plan?.name || 'Unknown'}</td>
                      <td>
                        <span className={`status ${subscription.status}`}>
                          {subscription.status}
                        </span>
                      </td>
                      <td>{formatINR(subscription.total_amount)}</td>
                      <td>{formatDate(subscription.start_date)}</td>
                      <td>{formatDate(subscription.end_date)}</td>
                      <td>
                        <button
                          className="action-btn"
                          onClick={() => {
                            setSelectedSubscription(subscription);
                            setShowExtendModal(true);
                          }}
                        >
                          Extend
                        </button>
                        <button
                          className="action-btn cancel"
                          onClick={() => handleCancelSubscription(subscription)}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="payments-section">
            <h3>Payment History</h3>
            <div className="payments-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Gateway</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>#{payment.id}</td>
                      <td>User #{payment.user_id}</td>
                      <td>{formatINR(payment.amount)}</td>
                      <td>
                        <span className={`status ${payment.status}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td>{payment.payment_gateway}</td>
                      <td>{formatDate(payment.created_at)}</td>
                      <td>
                        {payment.status === 'completed' && (
                          <button
                            className="action-btn refund"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setRefundAmount(payment.amount);
                              setShowRefundModal(true);
                            }}
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7}>No payments found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="plans-section">
            <div className="plans-header">
              <h3>Subscription Plans Management</h3>
              <button 
                className="btn primary"
                onClick={() => setShowCreatePlanModal(true)}
              >
                Create New Plan
              </button>
            </div>
            <div className="plans-grid">
              {plans.map((plan) => (
                <div key={plan.id} className="plan-card admin">
                  <div className="plan-header">
                    <h4>{plan.name}</h4>
                    <span className={`plan-status ${plan.is_active ? 'active' : 'inactive'}`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="plan-details">
                    <p className="plan-description">{plan.description}</p>
                    <div className="plan-price">
                      <span className="price">{formatINR(plan.price)}</span>
                      <span className="interval">/{plan.interval}</span>
                    </div>
                    <div className="plan-limits">
                      <p>Execution Limit: {plan.executionLimit}</p>
                      <p>Storage Limit: {plan.storageLimit} MB</p>
                      <p>AI Analysis Limit: {plan.aiAnalysisLimit || 10}/month</p>
                    </div>
                    <div className="plan-features">
                      <h5>Features:</h5>
                      <ul>
                        {plan.features.map((feature, index) => (
                          <li key={index}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="plan-actions">
                    <button 
                      className="action-btn edit"
                      onClick={() => handleEditPlan(plan)}
                    >
                      Edit Plan
                    </button>
                    <button 
                      className={`action-btn ${plan.is_active ? 'deactivate' : 'activate'}`}
                      onClick={() => handleTogglePlanStatus(plan)}
                    >
                      {plan.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={() => handleDeletePlan(plan)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-section">
            <h3>Revenue Analytics</h3>
            {analyticsLoading ? (
              <div className="loading">Loading analytics...</div>
            ) : revenueAnalytics ? (
              <div className="analytics-content">
                <div className="analytics-summary">
                  <div className="summary-card">
                    <h4>Total Revenue</h4>
                    <div className="value">{formatINR(revenueAnalytics.total_revenue)}</div>
                    <div className="growth">
                      Growth: {revenueAnalytics.revenue_growth > 0 ? '+' : ''}{revenueAnalytics.revenue_growth}%
                    </div>
                  </div>
                </div>

                <div className="top-plans-section">
                  <h4>Top Performing Plans</h4>
                  <div className="top-plans-list">
                    {revenueAnalytics.top_plans?.map((plan: any, index: number) => (
                      <div key={index} className="top-plan-item">
                        <span className="plan-name">{plan.plan_name}</span>
                        <span className="plan-revenue">{formatINR(plan.revenue)}</span>
                        <span className="plan-percentage">{plan.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="revenue-chart-section">
                  <h4>Revenue Trend</h4>
                  <div className="chart-placeholder">
                    <p>Revenue chart visualization would go here</p>
                    <div className="data-points">
                      {revenueAnalytics.data_points?.map((point: any, index: number) => (
                        <div key={index} className="data-point">
                          <span className="date">{point.date}</span>
                          <span className="revenue">{formatINR(point.revenue)}</span>
                          <span className="transactions">{point.transactions} transactions</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-data">No analytics data available</div>
            )}
          </div>
        )}
      </div>

      {/* Extend Subscription Modal */}
      {showExtendModal && selectedSubscription && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Extend Subscription</h3>
              <button className="close-btn" onClick={() => setShowExtendModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Extending subscription for User #{selectedSubscription.user_id}</p>
              <p>Current Plan: {selectedSubscription.plan?.name}</p>
              <p>Current End Date: {formatDate(selectedSubscription.end_date)}</p>

              <div className="form-group">
                <label>Extend by (days):</label>
                <input
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value))}
                  min="1"
                  max="365"
                />
              </div>

              <div className="form-group">
                <label>Reason (optional):</label>
                <textarea
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Enter reason for extension..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn cancel" onClick={() => setShowExtendModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleExtendSubscription}>
                Extend Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedPayment && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Process Refund</h3>
              <button className="close-btn" onClick={() => setShowRefundModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Processing refund for Payment #{selectedPayment.id}</p>
              <p>Original Amount: {formatINR(selectedPayment.amount)}</p>
              <p>Payment Gateway: {selectedPayment.payment_gateway}</p>

              <div className="form-group">
                <label>Refund Amount:</label>
                <input
                  type="number"
                  value={refundAmount || ''}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value))}
                  min="0.01"
                  max={selectedPayment.amount}
                  step="0.01"
                />
                <small>Leave empty for full refund</small>
              </div>

              <div className="form-group">
                <label>Reason:</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Enter reason for refund..."
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn cancel" onClick={() => setShowRefundModal(false)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={handleProcessRefund}
                disabled={!refundReason.trim()}
              >
                Process Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Plan Modal */}
      {showCreatePlanModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
              <button className="close-btn" onClick={() => setShowCreatePlanModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Plan Name</label>
                  <input
                    type="text"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    placeholder="Enter plan name"
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={planFormData.description}
                    onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
                    placeholder="Enter plan description"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Price ($)</label>
                    <input
                      type="number"
                      value={planFormData.price}
                      onChange={(e) => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Billing Interval</label>
                    <select
                      value={planFormData.interval}
                      onChange={(e) => setPlanFormData({ ...planFormData, interval: e.target.value })}
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Execution Limit</label>
                    <input
                      type="number"
                      value={planFormData.executionLimit}
                      onChange={(e) => setPlanFormData({ ...planFormData, executionLimit: parseInt(e.target.value) })}
                      min="0"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Storage Limit (MB)</label>
                    <input
                      type="number"
                      value={planFormData.storageLimit}
                      onChange={(e) => setPlanFormData({ ...planFormData, storageLimit: parseInt(e.target.value) })}
                      min="0"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>AI Analysis Limit (per month)</label>
                    <input
                      type="number"
                      value={planFormData.aiAnalysisLimit}
                      onChange={(e) => setPlanFormData({ ...planFormData, aiAnalysisLimit: parseInt(e.target.value) })}
                      min="0"
                      placeholder="Number of AI analyses allowed per month"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Features</label>
                  {planFormData.features.map((feature, index) => (
                    <div key={index} className="feature-input">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        placeholder="Enter feature"
                      />
                      {planFormData.features.length > 1 && (
                        <button
                          type="button"
                          className="remove-feature-btn"
                          onClick={() => removeFeature(index)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-feature-btn"
                    onClick={addFeature}
                  >
                    Add Feature
                  </button>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={planFormData.is_active}
                      onChange={(e) => setPlanFormData({ ...planFormData, is_active: e.target.checked })}
                    />
                    Active Plan
                  </label>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn cancel" onClick={() => setShowCreatePlanModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSavePlan}>
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;