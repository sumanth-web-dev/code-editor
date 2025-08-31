import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { paymentService } from '../services/paymentService';
import { formatCurrency } from '../utils/dataTransformers';
import { getErrorMessage } from '../utils/errorUtils';
import { SubscriptionPlan, PaymentData } from '../types';

const PaymentPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const duration = parseInt(searchParams.get('duration') || '1');
  const subscriptionId = searchParams.get('subscriptionId');
  const paymentId = searchParams.get('paymentId');

  useEffect(() => {
    loadPaymentData();
  }, [planId]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!planId) {
        setError('Plan ID is required');
        return;
      }

      // Get plan details
      const plans = await paymentService.getSubscriptionPlans();
      console.log('Available plans:', plans);
      console.log('Looking for plan ID:', planId, 'Type:', typeof planId);
      
      // Handle both string and number IDs for compatibility
      // URL params are always strings, but API might return numbers
      const targetPlanId = parseInt(planId || '0');
      const selectedPlan = plans.find(p => {
        const planIdAsNumber = typeof p.id === 'string' ? parseInt(p.id) : p.id;
        const planIdAsString = p.id?.toString();
        
        console.log(`Comparing plan ${p.name}: API ID=${p.id} (${typeof p.id}), URL param=${planId} (${typeof planId}), target=${targetPlanId}`);
        
        // Try multiple comparison methods
        return planIdAsNumber === targetPlanId || 
               planIdAsString === planId || 
               p.id === planId ||
               p.id === targetPlanId;
      });
      
      if (!selectedPlan) {
        console.error('Plan not found. Available plan IDs:', plans.map(p => `${p.id} (${typeof p.id})`));
        setError(`Plan not found. Available plans: ${plans.map(p => `${p.name} (ID: ${p.id})`).join(', ')}`);
        return;
      }
      
      console.log('Selected plan:', selectedPlan);

      setPlan(selectedPlan);

      // If we have payment data from URL params, use it
      if (subscriptionId && paymentId) {
        setPaymentData({
          subscription_id: parseInt(subscriptionId),
          payment_id: parseInt(paymentId),
          status: 'pending',
          payment_url: window.location.href
        });
      }

    } catch (error: any) {
      console.error('Error loading payment data:', error);
      setError(error.message || 'Failed to load payment information');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (method: 'stripe' | 'razorpay' | 'paypal') => {
    if (!plan) return;

    try {
      setProcessing(true);
      setError(null);

      // Create subscription if not already created
      if (!paymentData) {
        const planIdNumber = typeof plan.id === 'string' ? parseInt(plan.id) : plan.id;
        if (isNaN(planIdNumber)) {
          throw new Error('Invalid plan ID');
        }
        
        const result = await paymentService.createSubscription(
          planIdNumber,
          undefined,
          undefined,
          duration * 30,
          method
        );
        setPaymentData(result);
      }

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real implementation, this would integrate with actual payment gateways
      if (method === 'stripe') {
        // Simulate Stripe payment
        await simulatePayment('Stripe');
      } else if (method === 'razorpay') {
        // Simulate Razorpay payment
        await simulatePayment('Razorpay');
      } else if (method === 'paypal') {
        // Simulate PayPal payment
        await simulatePayment('PayPal');
      }

    } catch (error: any) {
      console.error('Payment failed:', error);
      setError(error.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const simulatePayment = async (gateway: string) => {
    // Simulate payment gateway processing
    const success = Math.random() > 0.1; // 90% success rate for demo

    if (success) {
      // Confirm payment
      if (paymentData?.payment_id) {
        await paymentService.confirmPayment(
          paymentData.payment_id,
          `${gateway.toLowerCase()}_${Date.now()}`
        );
      }
      
      setSuccess(true);
      
      // Redirect to success page after 3 seconds
      setTimeout(() => {
        navigate('/subscriptions?success=true');
      }, 3000);
    } else {
      throw new Error(`${gateway} payment failed. Please try again.`);
    }
  };

  const calculateTotal = () => {
    if (!plan) return 0;
    return plan.price * duration;
  };

  if (loading) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          <div className="loading">Loading payment information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          <div className="error-message">
            <h2>Payment Error</h2>
            <p>{getErrorMessage(error)}</p>
            <button onClick={() => navigate('/subscriptions')} className="btn primary">
              Back to Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="payment-page">
        <div className="payment-container">
          <div className="success-message">
            <div className="success-icon">✅</div>
            <h2>Payment Successful!</h2>
            <p>Your subscription has been activated successfully.</p>
            <p>Redirecting to your subscriptions...</p>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-container">
        <div className="payment-header">
          <h1>Complete Your Payment</h1>
          <p>You're subscribing to the {plan?.name} plan</p>
        </div>

        <div className="payment-content">
          <div className="order-summary">
            <h3>Order Summary</h3>
            <div className="summary-item">
              <span>Plan: {plan?.name}</span>
              <span>{formatCurrency(plan?.price || 0)}</span>
            </div>
            <div className="summary-item">
              <span>Duration: {duration} month{duration > 1 ? 's' : ''}</span>
              <span>×{duration}</span>
            </div>
            <div className="summary-divider"></div>
            <div className="summary-item total">
              <span>Total</span>
              <span>{formatCurrency(calculateTotal())}</span>
            </div>
            
            <div className="plan-features">
              <h4>What's included:</h4>
              <ul>
                {plan?.features.map((feature, index) => (
                  <li key={index}>✓ {feature}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="payment-methods">
            <h3>Choose Payment Method</h3>
            
            <div className="payment-options">
              <button
                className="payment-option stripe"
                onClick={() => handlePayment('stripe')}
                disabled={processing}
              >
                <div className="payment-logo">
                  <img src="/stripe-logo.png" alt="Stripe" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling!.textContent = 'Stripe';
                  }} />
                  <span style={{ display: 'none' }}>Stripe</span>
                </div>
                <div className="payment-info">
                  <strong>Credit/Debit Card</strong>
                  <p>Secure payment with Stripe</p>
                </div>
              </button>

              <button
                className="payment-option razorpay"
                onClick={() => handlePayment('razorpay')}
                disabled={processing}
              >
                <div className="payment-logo">
                  <img src="/razorpay-logo.png" alt="Razorpay" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling!.textContent = 'Razorpay';
                  }} />
                  <span style={{ display: 'none' }}>Razorpay</span>
                </div>
                <div className="payment-info">
                  <strong>UPI, Cards, Net Banking</strong>
                  <p>Multiple payment options</p>
                </div>
              </button>

              <button
                className="payment-option paypal"
                onClick={() => handlePayment('paypal')}
                disabled={processing}
              >
                <div className="payment-logo">
                  <img src="/paypal-logo.png" alt="PayPal" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling!.textContent = 'PayPal';
                  }} />
                  <span style={{ display: 'none' }}>PayPal</span>
                </div>
                <div className="payment-info">
                  <strong>PayPal</strong>
                  <p>Pay with your PayPal account</p>
                </div>
              </button>
            </div>

            {processing && (
              <div className="processing-message">
                <div className="loading-spinner"></div>
                <p>Processing your payment...</p>
              </div>
            )}
          </div>
        </div>

        <div className="payment-footer">
          <button onClick={() => navigate('/subscriptions')} className="btn secondary">
            Back to Plans
          </button>
          <div className="security-info">
            <span>🔒 Secure payment powered by industry-leading encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;