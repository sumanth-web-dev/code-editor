import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePayments } from '../hooks/usePayments';
import { SubscriptionPlan, UserSubscription } from '../types';
import { formatDate, formatCurrency } from '../utils/dataTransformers';
import { getErrorMessage } from '../utils/errorUtils';
import PaymentErrorBoundary from '../components/PaymentErrorBoundary';
import './SubscriptionsPage.css';

interface PlanCardProps {
  plan: SubscriptionPlan;
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  onSubscribe: (planId: string | number) => void;
  loading: boolean;
  subscribingPlan: string | null;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isPopular = false,
  isCurrentPlan = false,
  onSubscribe,
  loading,
  subscribingPlan
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'basic': 
      case 'starter': return '🚀';
      case 'premium': 
      case 'pro': return '⭐';
      case 'annual': 
      case 'yearly': return '💎';
      case 'enterprise': return '🏢';
      case 'daily': return '⚡';
      case 'monthly': return '📅';
      default: return '📦';
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'basic': 
      case 'starter': return '#10b981';
      case 'premium': 
      case 'pro': return '#8b5cf6';
      case 'annual': 
      case 'yearly': return '#f59e0b';
      case 'enterprise': return '#ef4444';
      case 'daily': return '#06b6d4';
      case 'monthly': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getPlanGradient = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'basic': 
      case 'starter': return 'linear-gradient(135deg, #10b981, #059669)';
      case 'premium': 
      case 'pro': return 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
      case 'annual': 
      case 'yearly': return 'linear-gradient(135deg, #f59e0b, #d97706)';
      case 'enterprise': return 'linear-gradient(135deg, #ef4444, #dc2626)';
      case 'daily': return 'linear-gradient(135deg, #06b6d4, #0891b2)';
      case 'monthly': return 'linear-gradient(135deg, #3b82f6, #2563eb)';
      default: return 'linear-gradient(135deg, #6b7280, #4b5563)';
    }
  };

  return (
    <div 
      className={`plan-card ${isPopular ? 'popular' : ''} ${isCurrentPlan ? 'current' : ''} ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        '--plan-color': getPlanColor(plan.name),
        '--plan-gradient': getPlanGradient(plan.name)
      } as React.CSSProperties}
    >
      {isPopular && (
        <div className="popular-badge">
          <span className="badge-icon">🔥</span>
          Most Popular
        </div>
      )}
      {isCurrentPlan && (
        <div className="current-badge">
          <span className="badge-icon">✓</span>
          Current Plan
        </div>
      )}
      
      <div className="plan-header">
        <div className="plan-icon-container">
          <div className="plan-icon">{getPlanIcon(plan.name)}</div>
          <div className="plan-icon-bg"></div>
        </div>
        <h3 className="plan-name">{plan.name}</h3>
        <p className="plan-description">{plan.description}</p>
      </div>

      <div className="plan-pricing">
        <div className="price-container">
          <span className="currency">₹</span>
          <span className="price">{Math.floor(plan.price)}</span>
          <span className="decimal">.{(plan.price % 1).toFixed(2).slice(2)}</span>
        </div>
        <div className="billing-period">per {plan.interval}</div>
        {(plan.interval === 'year' || plan.interval === 'yearly') && (
          <div className="savings-badge">
            <span className="savings-icon">💰</span>
            Save 20%
          </div>
        )}
        {plan.interval === 'daily' && (
          <div className="trial-badge">
            <span className="trial-icon">⚡</span>
            Perfect for Testing
          </div>
        )}
      </div>

      <div className="plan-features">
        <h4>✨ What's included:</h4>
        <ul>
          {plan.features.map((feature, index) => (
            <li key={index} className="feature-item">
              <span className="feature-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" fill="currentColor"/>
                </svg>
              </span>
              <span className="feature-text">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="plan-limits">
        <h5>📊 Usage Limits:</h5>
        <div className="limits-grid">
          <div className="limit-item">
            <div className="limit-icon">🚀</div>
            <div className="limit-content">
              <span className="limit-label">Code Executions</span>
              <span className="limit-value">{(plan.executionLimit || 0).toLocaleString()}/month</span>
            </div>
          </div>
          <div className="limit-item">
            <div className="limit-icon">💾</div>
            <div className="limit-content">
              <span className="limit-label">Storage</span>
              <span className="limit-value">{((plan.storageLimit || 0) / 1024).toFixed(1)} GB</span>
            </div>
          </div>
          <div className="limit-item">
            <div className="limit-icon">🤖</div>
            <div className="limit-content">
              <span className="limit-label">AI Analysis</span>
              <span className="limit-value">{plan.aiAnalysisLimit || 0}/month</span>
            </div>
          </div>
        </div>
      </div>

      <div className="plan-action">
        {isCurrentPlan ? (
          <button className="btn-current" disabled>
            <span className="btn-icon">✓</span>
            <span>Current Plan</span>
          </button>
        ) : (
          <button
            className={`btn-subscribe ${isPopular ? 'popular' : ''} ${isHovered ? 'hovered' : ''}`}
            onClick={() => onSubscribe(plan.id)}
            disabled={loading || subscribingPlan === plan.id.toString()}
          >
            {subscribingPlan === plan.id.toString() ? (
              <span className="loading-spinner">
                <span className="spinner"></span>
                Processing...
              </span>
            ) : (
              <span className="btn-content">
                <span className="btn-text">Get Started</span>
                <span className="btn-arrow">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8.146 3.146a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L11.293 8.5H2.5a.5.5 0 0 1 0-1h8.793L8.146 4.354a.5.5 0 0 1 0-.708z" fill="currentColor"/>
                  </svg>
                </span>
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

const SubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, plans, loading, createSubscription, cancelSubscription } = usePayments();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    // Check for success parameter from payment redirect
    if (searchParams.get('success') === 'true') {
      setSuccess('🎉 Payment successful! Your subscription is now active.');
      // Clear the URL parameter
      window.history.replaceState({}, '', '/subscriptions');
    }
  }, [searchParams]);

  const handleSubscribe = async (planId: string | number) => {
    try {
      setError(null);
      setSuccess(null);
      setSubscribingPlan(planId.toString());
      
      console.log('Attempting to subscribe to plan:', planId);
      
      // Create subscription with default 30 days duration
      const result = await createSubscription(planId, undefined, undefined, 30);
      console.log('Subscription result:', result);
      
      setSuccess('Subscription created successfully! Redirecting to payment...');
      
      // Redirect to payment page with subscription details
      setTimeout(() => {
        const paymentUrl = `/payment/${planId}`;
        if (result.subscription_id && result.payment_id) {
          navigate(`${paymentUrl}?subscriptionId=${result.subscription_id}&paymentId=${result.payment_id}`);
        } else {
          navigate(paymentUrl);
        }
      }, 1500);
      
    } catch (error: any) {
      console.error('Subscription failed:', error);
      setError(error.message || 'Failed to create subscription. Please try again.');
      setSubscribingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    try {
      await cancelSubscription(subscription.id);
      setSuccess('Subscription cancelled successfully.');
      setShowCancelModal(false);
    } catch (error: any) {
      console.error('Cancellation failed:', error);
      setError(error.message || 'Failed to cancel subscription.');
    }
  };

  const getPopularPlanId = () => {
    // Mark the middle-priced plan as popular, or Premium if it exists
    const sortedPlans = [...plans].sort((a, b) => a.price - b.price);
    const premiumPlan = plans.find(p => p.name.toLowerCase().includes('premium'));
    return premiumPlan?.id || sortedPlans[Math.floor(sortedPlans.length / 2)]?.id;
  };

  return (
    <PaymentErrorBoundary>
      <div className="subscriptions-page">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-background">
            <div className="hero-pattern"></div>
            <div className="hero-gradient"></div>
          </div>
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">🚀</span>
              <span>Power Up Your Coding Experience</span>
            </div>
            <h1 className="hero-title">
              Choose Your Perfect
              <span className="title-highlight"> Coding Plan</span>
            </h1>
            <p className="hero-subtitle">
              Unlock the full potential of our AI-powered code editor with unlimited executions, 
              advanced features, and premium support. Start coding smarter today.
            </p>
            <div className="hero-features">
              <div className="hero-feature">
                <span className="feature-icon">⚡</span>
                <span>Instant Code Execution</span>
              </div>
              <div className="hero-feature">
                <span className="feature-icon">🤖</span>
                <span>AI-Powered Analysis</span>
              </div>
              <div className="hero-feature">
                <span className="feature-icon">🔒</span>
                <span>Secure & Private</span>
              </div>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">10K+</span>
                <span className="stat-label">Active Developers</span>
              </div>
              <div className="stat">
                <span className="stat-number">1M+</span>
                <span className="stat-label">Code Executions</span>
              </div>
              <div className="stat">
                <span className="stat-number">99.9%</span>
                <span className="stat-label">Uptime</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="notification error">
            <div className="notification-icon">⚠️</div>
            <div className="notification-content">
              <strong>Error:</strong> {getErrorMessage(error)}
            </div>
            <button 
              className="notification-close"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="notification success">
            <div className="notification-icon">✅</div>
            <div className="notification-content">
              {success}
            </div>
            <button 
              className="notification-close"
              onClick={() => setSuccess(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Current Subscription */}
        {subscription && (
          <div className="current-subscription">
            <div className="subscription-header">
              <h2>Your Current Subscription</h2>
              <div className={`status-badge ${subscription.status}`}>
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </div>
            </div>
            
            <div className="subscription-card">
              <div className="subscription-info">
                <div className="subscription-plan">
                  <h3>{subscription.plan?.name || 'Unknown Plan'}</h3>
                  <p className="plan-price">
                    {formatCurrency(subscription.total_amount, subscription.currency)}
                    <span className="billing-cycle">/{subscription.plan?.interval}</span>
                  </p>
                </div>
                
                <div className="subscription-details">
                  <div className="detail-item">
                    <span className="detail-label">Started:</span>
                    <span className="detail-value">{formatDate(subscription.start_date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Expires:</span>
                    <span className="detail-value">{formatDate(subscription.end_date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Days Remaining:</span>
                    <span className="detail-value days-remaining">
                      {subscription.days_remaining} days
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="subscription-actions">
                <button 
                  className="btn-cancel"
                  onClick={() => setShowCancelModal(true)}
                  disabled={loading}
                >
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plans Section */}
        <div className="plans-section">
          <div className="section-header">
            <h2>Choose Your Plan</h2>
            <p>All plans include our core features. Upgrade anytime.</p>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner-large">
                <div className="spinner-large"></div>
              </div>
              <p>Loading subscription plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No Plans Available</h3>
              <p>We're working on bringing you amazing subscription plans. Check back soon!</p>
            </div>
          ) : (
            <div className="plans-grid">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isPopular={plan.id === getPopularPlanId()}
                  isCurrentPlan={plan.id.toString() === subscription?.plan_id?.toString()}
                  onSubscribe={handleSubscribe}
                  loading={loading}
                  subscribingPlan={subscribingPlan}
                />
              ))}
            </div>
          )}
        </div>



        {/* FAQ Section */}
        <div className="faq-section">
          <div className="section-header">
            <h2>Frequently Asked Questions</h2>
          </div>
          
          <div className="faq-grid">
            <div className="faq-item">
              <h3>Can I change my plan anytime?</h3>
              <p>Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated.</p>
            </div>
            
            <div className="faq-item">
              <h3>What payment methods do you accept?</h3>
              <p>We accept all major credit cards, debit cards, and UPI payments through secure payment gateways.</p>
            </div>
            
            <div className="faq-item">
              <h3>Is there a free trial?</h3>
              <p>Yes, all new users get a 7-day free trial with full access to premium features.</p>
            </div>
            
            <div className="faq-item">
              <h3>Can I cancel anytime?</h3>
              <p>Absolutely! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.</p>
            </div>
          </div>
        </div>

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Cancel Subscription</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowCancelModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <p>Are you sure you want to cancel your subscription?</p>
                <p className="modal-warning">
                  You'll lose access to premium features at the end of your current billing period.
                </p>
              </div>
              
              <div className="modal-footer">
                <button 
                  className="btn-secondary"
                  onClick={() => setShowCancelModal(false)}
                >
                  Keep Subscription
                </button>
                <button 
                  className="btn-danger"
                  onClick={handleCancelSubscription}
                  disabled={loading}
                >
                  {loading ? 'Cancelling...' : 'Cancel Subscription'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PaymentErrorBoundary>
  );
};

export default SubscriptionsPage;