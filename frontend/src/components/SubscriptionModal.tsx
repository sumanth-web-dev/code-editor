import React, { useState, useEffect } from 'react';
import { getErrorMessage } from '../utils/errorUtils';
import './SubscriptionModal.css';

interface Plan {
  id: number;
  name: string;
  description: string;
  plan_type: string;
  price_per_unit: number;
  currency: string;
  features: Record<string, any>;
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscriptionSuccess: () => void;
  user: any;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubscriptionSuccess,
  user
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'plans' | 'custom' | 'payment'>('plans');
  
  // Custom duration state
  const [customDuration, setCustomDuration] = useState({
    days: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });
  
  // Cost calculation state
  const [costCalculation, setCostCalculation] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  useEffect(() => {
    if (customDuration.days > 0) {
      const startDate = new Date(customDuration.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + customDuration.days - 1);
      setCustomDuration(prev => ({
        ...prev,
        endDate: endDate.toISOString().split('T')[0]
      }));
    }
  }, [customDuration.days, customDuration.startDate]);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/payments/plans');
      const data = await response.json();
      
      if (data.success) {
        setPlans(data.plans);
      } else {
        setError('Failed to load subscription plans');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const calculateCost = async (plan: Plan) => {
    try {
      const payload: any = { plan_id: plan.id };
      
      if (plan.plan_type === 'custom') {
        payload.duration_days = customDuration.days;
        payload.start_date = customDuration.startDate;
      }

      const response = await fetch('/api/payments/calculate-cost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (data.success) {
        setCostCalculation(data.cost_calculation);
      } else {
        setError(data.error || 'Failed to calculate cost');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setError('');
    
    if (plan.plan_type === 'custom') {
      setStep('custom');
    } else {
      calculateCost(plan);
      setStep('payment');
    }
  };

  const handleCustomDurationConfirm = () => {
    if (selectedPlan && customDuration.days > 0) {
      calculateCost(selectedPlan);
      setStep('payment');
    }
  };

  const createSubscription = async () => {
    if (!selectedPlan || !user) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const payload: any = { plan_id: selectedPlan.id };
      
      if (selectedPlan.plan_type === 'custom') {
        payload.duration_days = customDuration.days;
        payload.start_date = customDuration.startDate;
      }

      const response = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        // In a real implementation, redirect to payment gateway
        // For now, simulate successful payment
        alert('Subscription created successfully! Redirecting to payment...');
        onSubscriptionSuccess();
        onClose();
      } else {
        setError(data.error || 'Failed to create subscription');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  const getPlanDuration = (plan: Plan) => {
    switch (plan.plan_type) {
      case 'daily': return '1 day';
      case 'monthly': return '1 month';
      case 'yearly': return '1 year';
      case 'custom': return 'Custom duration';
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="subscription-modal-overlay" onClick={onClose}>
      <div className="subscription-modal" onClick={(e) => e.stopPropagation()}>
        <div className="subscription-modal-header">
          <h2>Choose Your Plan</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && <div className="error-message">{getErrorMessage(error)}</div>}

        {step === 'plans' && (
          <div className="plans-container">
            <div className="plans-grid">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-card ${plan.plan_type === 'yearly' ? 'popular' : ''}`}
                  onClick={() => handlePlanSelect(plan)}
                >
                  {plan.plan_type === 'yearly' && (
                    <div className="popular-badge">Most Popular</div>
                  )}
                  
                  <div className="plan-header">
                    <h3>{plan.name}</h3>
                    <div className="plan-price">
                      {formatPrice(plan.price_per_unit)}
                      <span className="plan-period">/{plan.plan_type === 'custom' ? 'day' : plan.plan_type.slice(0, -2)}</span>
                    </div>
                  </div>

                  <p className="plan-description">{plan.description}</p>

                  <div className="plan-duration">
                    <strong>Duration:</strong> {getPlanDuration(plan)}
                  </div>

                  <div className="plan-features">
                    <h4>Features:</h4>
                    <ul>
                      {plan.features.ai_analysis && <li>✓ AI Code Analysis</li>}
                      {plan.features.code_execution && <li>✓ Code Execution</li>}
                      {plan.features.languages === 'all' && <li>✓ All Programming Languages</li>}
                      {plan.features.priority_support && <li>✓ Priority Support</li>}
                      {plan.features.advanced_features && <li>✓ Advanced Features</li>}
                      {!plan.features.daily_limit && <li>✓ Unlimited Usage</li>}
                    </ul>
                  </div>

                  <button className="select-plan-button">
                    Select Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'custom' && selectedPlan && (
          <div className="custom-duration-container">
            <h3>Customize Your Duration</h3>
            <p>Configure your custom subscription period</p>

            <div className="custom-form">
              <div className="form-group">
                <label htmlFor="duration-days">Number of Days</label>
                <input
                  type="number"
                  id="duration-days"
                  min="1"
                  max="365"
                  value={customDuration.days}
                  onChange={(e) => setCustomDuration(prev => ({
                    ...prev,
                    days: parseInt(e.target.value) || 1
                  }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="start-date">Start Date</label>
                <input
                  type="date"
                  id="start-date"
                  value={customDuration.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCustomDuration(prev => ({
                    ...prev,
                    startDate: e.target.value
                  }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="end-date">End Date</label>
                <input
                  type="date"
                  id="end-date"
                  value={customDuration.endDate}
                  readOnly
                />
              </div>

              <div className="cost-preview">
                <div className="cost-calculation">
                  <span>Total Cost: </span>
                  <strong>{formatPrice(selectedPlan.price_per_unit * customDuration.days)}</strong>
                </div>
                <small>
                  {formatPrice(selectedPlan.price_per_unit)} × {customDuration.days} days
                </small>
              </div>

              <div className="custom-actions">
                <button
                  className="back-button"
                  onClick={() => setStep('plans')}
                >
                  Back to Plans
                </button>
                <button
                  className="continue-button"
                  onClick={handleCustomDurationConfirm}
                  disabled={customDuration.days < 1}
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'payment' && selectedPlan && costCalculation && (
          <div className="payment-container">
            <h3>Confirm Your Subscription</h3>
            
            <div className="subscription-summary">
              <div className="summary-item">
                <span>Plan:</span>
                <strong>{selectedPlan.name}</strong>
              </div>
              
              {selectedPlan.plan_type === 'custom' && (
                <>
                  <div className="summary-item">
                    <span>Duration:</span>
                    <strong>{costCalculation.duration_days} days</strong>
                  </div>
                  <div className="summary-item">
                    <span>Start Date:</span>
                    <strong>{costCalculation.start_date}</strong>
                  </div>
                  <div className="summary-item">
                    <span>End Date:</span>
                    <strong>{costCalculation.end_date}</strong>
                  </div>
                </>
              )}
              
              <div className="summary-item total">
                <span>Total Amount:</span>
                <strong>{formatPrice(costCalculation.total_cost, costCalculation.currency)}</strong>
              </div>
            </div>

            <div className="payment-methods">
              <h4>Payment Method</h4>
              <div className="payment-method-options">
                <label className="payment-option">
                  <input type="radio" name="payment-method" value="stripe" defaultChecked />
                  <span>Credit/Debit Card (Stripe)</span>
                </label>
                <label className="payment-option">
                  <input type="radio" name="payment-method" value="razorpay" />
                  <span>Razorpay</span>
                </label>
              </div>
            </div>

            <div className="payment-actions">
              <button
                className="back-button"
                onClick={() => setStep(selectedPlan.plan_type === 'custom' ? 'custom' : 'plans')}
              >
                Back
              </button>
              <button
                className="pay-button"
                onClick={createSubscription}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Pay ${formatPrice(costCalculation.total_cost)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionModal;