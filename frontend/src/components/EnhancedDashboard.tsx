import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { getErrorMessage } from '../utils/errorUtils';
import { 
  LineChart, 
  BarChart, 
  PieChart, 
  DonutChart, 
  StatsCard, 
  ActivityTimeline 
} from './charts/ChartComponents';
import './EnhancedDashboard.css';

interface DashboardData {
  total_users: number;
  active_subscriptions: number;
  total_revenue: number;
  monthly_revenue: number;
  new_users_today: number;
  new_subscriptions_today: number;
  revenue_today: number;
  analytics: any;
  currency: string;
  top_plans: Array<{
    plan_name: string;
    subscribers: number;
    revenue: number;
  }>;
  recent_activity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

const EnhancedDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const data = await adminService.getDashboardAnalytics();
        setDashboardData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatINR = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="enhanced-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="enhanced-dashboard error">
        <div className="error-message">
          <h3>Error Loading Dashboard</h3>
          <p>{getErrorMessage(error)}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="enhanced-dashboard no-data">
        <p>No dashboard data available</p>
      </div>
    );
  }

  const { analytics } = dashboardData;

  return (
    <div className="enhanced-dashboard">
      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <StatsCard
          title="Total Users"
          value={dashboardData.total_users.toLocaleString()}
          change={{
            value: analytics?.user_growth_rate || 0,
            type: 'increase',
            period: 'this month'
          }}
          icon="👥"
          color="#3b82f6"
        />
        <StatsCard
          title="Active Subscriptions"
          value={dashboardData.active_subscriptions.toLocaleString()}
          change={{
            value: analytics?.subscription_growth_rate || 0,
            type: 'increase',
            period: 'this month'
          }}
          icon="📋"
          color="#10b981"
        />
        <StatsCard
          title="Monthly Revenue"
          value={formatINR(dashboardData.monthly_revenue)}
          change={{
            value: analytics?.revenue_growth || 0,
            type: analytics?.revenue_growth >= 0 ? 'increase' : 'decrease',
            period: 'vs last month'
          }}
          icon="💰"
          color="#f59e0b"
        />
        <StatsCard
          title="Conversion Rate"
          value={`${analytics?.conversion_rate?.toFixed(1) || 0}%`}
          change={{
            value: 2.3,
            type: 'increase',
            period: 'this month'
          }}
          icon="📈"
          color="#8b5cf6"
        />
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="charts-row">
          <div className="chart-container">
            <h3>Revenue Trend (Last 12 Months)</h3>
            {analytics?.chart_data?.monthly_revenue && (
              <LineChart
                data={{
                  labels: analytics.chart_data.monthly_revenue.labels,
                  datasets: [{
                    label: 'Revenue (₹)',
                    data: analytics.chart_data.monthly_revenue.data,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: '#3b82f6',
                    borderWidth: 2
                  }]
                }}
                title="Monthly Revenue Trend"
                height={300}
              />
            )}
          </div>
          
          <div className="chart-container">
            <h3>Plan Distribution</h3>
            {analytics?.chart_data?.top_plans && (
              <BarChart
                data={{
                  labels: analytics.chart_data.top_plans.map((p: any) => p.name),
                  datasets: [{
                    label: 'Subscribers',
                    data: analytics.chart_data.top_plans.map((p: any) => p.subscribers),
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1
                  }]
                }}
                title="Subscribers by Plan"
                height={300}
              />
            )}
          </div>
        </div>

        <div className="charts-row">
          <div className="chart-container">
            <h3>Payment Methods</h3>
            {analytics?.chart_data?.payment_methods && (
              <PieChart
                data={{
                  labels: analytics.chart_data.payment_methods.map((p: any) => p.method),
                  values: analytics.chart_data.payment_methods.map((p: any) => p.percentage),
                  colors: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444']
                }}
                title="Payment Method Distribution"
              />
            )}
          </div>
          
          <div className="chart-container">
            <h3>Subscription Status</h3>
            {analytics?.chart_data?.subscription_status && (
              <DonutChart
                data={{
                  labels: analytics.chart_data.subscription_status.map((s: any) => s.status),
                  values: analytics.chart_data.subscription_status.map((s: any) => s.count),
                  colors: ['#10b981', '#f59e0b', '#ef4444', '#6b7280']
                }}
                title="Subscription Status"
                centerText={`${dashboardData.active_subscriptions} Active`}
              />
            )}
          </div>
        </div>

        <div className="charts-row">
          <div className="chart-container full-width">
            <h3>User Growth (Last 12 Months)</h3>
            {analytics?.chart_data?.user_growth && (
              <BarChart
                data={{
                  labels: analytics.chart_data.user_growth.labels,
                  datasets: [{
                    label: 'New Users',
                    data: analytics.chart_data.user_growth.data,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1
                  }]
                }}
                title="Monthly User Growth"
                height={250}
              />
            )}
          </div>
        </div>
      </div>

      {/* Top Plans Performance */}
      <div className="top-plans-section">
        <h3>Top Performing Plans</h3>
        <div className="plans-performance">
          {dashboardData.top_plans.map((plan, index) => (
            <div key={index} className="plan-performance-card">
              <div className="plan-rank">#{index + 1}</div>
              <div className="plan-info">
                <h4>{plan.plan_name}</h4>
                <div className="plan-metrics">
                  <span className="subscribers">{plan.subscribers} subscribers</span>
                  <span className="revenue">{formatINR(plan.revenue)} revenue</span>
                </div>
              </div>
              <div className="plan-progress">
                <div 
                  className="progress-bar" 
                  style={{ 
                    width: `${(plan.revenue / Math.max(...dashboardData.top_plans.map(p => p.revenue))) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <ActivityTimeline
          activities={dashboardData.recent_activity.map((activity, index) => {
            // Map activity type to valid ActivityItem type
            const validTypes: ('user' | 'payment' | 'subscription' | 'system')[] = ['user', 'payment', 'subscription', 'system'];
            const activityType = validTypes.includes(activity.type as any) ? activity.type as 'user' | 'payment' | 'subscription' | 'system' : 'system';
            
            return {
              id: index.toString(),
              type: activityType,
              title: activity.type.charAt(0).toUpperCase() + activity.type.slice(1),
              description: activity.message,
              timestamp: activity.timestamp,
              user: 'System'
            };
          })}
          title="Recent Activity"
        />
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-item">
          <span className="stat-label">Today's Revenue</span>
          <span className="stat-value">{formatINR(dashboardData.revenue_today)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">New Users Today</span>
          <span className="stat-value">{dashboardData.new_users_today}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">New Subscriptions Today</span>
          <span className="stat-value">{dashboardData.new_subscriptions_today}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Revenue</span>
          <span className="stat-value">{formatINR(dashboardData.total_revenue)}</span>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboard;