import axios from 'axios';
import { 
  SubscriptionPlan, 
  UserSubscription, 
  Payment, 
  CostCalculation, 
  PaymentData 
} from '../types';
import { authService } from './authService';

// Configure base URL for API calls
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

const paymentClient = axios.create({
  baseURL: `${API_BASE_URL}/api/payments`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token (optional for development)
paymentClient.interceptors.request.use(
  (config) => {
    try {
      const token = authService.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Auth service not available, continuing without auth token');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
paymentClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Payment API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      }
    });
    
    if (error.response?.status === 401) {
      try {
        // Token expired, redirect to login
        authService.logout();
        window.location.href = '/login';
      } catch (authError) {
        console.warn('Auth service not available for logout');
      }
    }
    return Promise.reject(error);
  }
);

class PaymentService {
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      console.log('Fetching subscription plans from:', `${API_BASE_URL}/api/payments/plans`);
      const response = await paymentClient.get('/plans');
      
      console.log('Subscription plans response:', response.data);
      
      if (response.data.success) {
        return response.data.plans;
      } else {
        throw new Error(response.data.error || 'Failed to get subscription plans');
      }
    } catch (error: any) {
      console.error('Error fetching subscription plans:', error);
      
      // Return mock data if API is not available
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error') || !error.response) {
        console.warn('API not available, returning mock subscription plans');
        return [
          {
            id: 1,
            name: 'Basic',
            description: 'Perfect for beginners and students learning to code',
            price: 499,
            currency: 'INR',
            interval: 'month',
            features: [
              'Code execution in 15+ languages',
              'Basic code analysis',
              'Community support',
              'Save up to 10 projects',
              'Standard execution speed'
            ],
            plan_type: 'monthly',
            executionLimit: 500,
            storageLimit: 1024,
            aiAnalysisLimit: 10,
            is_active: true
          },
          {
            id: 2,
            name: 'Premium',
            description: 'Ideal for developers and professionals',
            price: 999,
            currency: 'INR',
            interval: 'month',
            features: [
              'Everything in Basic',
              'Advanced AI code analysis',
              'Priority support',
              'Unlimited projects',
              'Fast execution speed',
              'Code collaboration tools',
              'Export & share features'
            ],
            plan_type: 'monthly',
            executionLimit: 2000,
            storageLimit: 5120,
            aiAnalysisLimit: 100,
            is_active: true
          },
          {
            id: 3,
            name: 'Pro',
            description: 'For teams and advanced developers',
            price: 1999,
            currency: 'INR',
            interval: 'month',
            features: [
              'Everything in Premium',
              'Team collaboration',
              'Advanced debugging tools',
              'Custom execution environments',
              'API access',
              'Priority email support',
              'Advanced analytics',
              'White-label options'
            ],
            plan_type: 'monthly',
            executionLimit: 10000,
            storageLimit: 20480,
            aiAnalysisLimit: 500,
            is_active: true
          },
          {
            id: 4,
            name: 'Annual Basic',
            description: 'Basic plan with annual savings',
            price: 4990,
            currency: 'INR',
            interval: 'year',
            features: [
              'Everything in Basic monthly',
              '2 months free',
              'Annual priority support',
              'Bonus storage'
            ],
            plan_type: 'yearly',
            executionLimit: 6000,
            storageLimit: 2048,
            aiAnalysisLimit: 120,
            is_active: true
          },
          {
            id: 5,
            name: 'Annual Premium',
            description: 'Premium plan with maximum savings',
            price: 9990,
            currency: 'INR',
            interval: 'year',
            features: [
              'Everything in Premium monthly',
              '2 months free',
              'Annual priority support',
              'Bonus features',
              'Early access to new features'
            ],
            plan_type: 'yearly',
            executionLimit: 24000,
            storageLimit: 10240,
            aiAnalysisLimit: 1200,
            is_active: true
          }
        ];
      }
      
      throw new Error(error.response?.data?.error || error.message || 'Failed to get subscription plans');
    }
  }

  async calculateCost(
    planId: number, 
    startDate?: string, 
    endDate?: string, 
    durationDays?: number
  ): Promise<CostCalculation> {
    try {
      // Ensure planId is a number
      const numericPlanId = typeof planId === 'string' ? parseInt(planId) : planId;
      const payload: any = { plan_id: numericPlanId };
      
      if (startDate) payload.start_date = startDate;
      if (endDate) payload.end_date = endDate;
      if (durationDays) payload.duration_days = durationDays;

      const response = await paymentClient.post('/calculate-cost', payload);
      
      if (response.data.success) {
        return response.data.cost_calculation;
      } else {
        throw new Error(response.data.error || 'Failed to calculate cost');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to calculate cost');
    }
  }

  async createSubscription(
    planId: number,
    startDate?: string,
    endDate?: string,
    durationDays?: number,
    paymentGateway?: string
  ): Promise<PaymentData> {
    try {
      // Ensure planId is a number
      const numericPlanId = typeof planId === 'string' ? parseInt(planId) : planId;
      const payload: any = { plan_id: numericPlanId };
      
      if (startDate) payload.start_date = startDate;
      if (endDate) payload.end_date = endDate;
      if (durationDays) payload.duration_days = durationDays;
      if (paymentGateway) payload.payment_gateway = paymentGateway;

      console.log('Creating subscription with payload:', payload);
      const response = await paymentClient.post('/create-subscription', payload);
      
      console.log('Create subscription response:', response.data);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to create subscription');
      }
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      
      // Return mock data if API is not available
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error') || !error.response) {
        console.warn('API not available, returning mock subscription data');
        return {
          subscription_id: 123,
          payment_id: 456,
          status: 'pending',
          payment_url: 'https://mock-payment-gateway.com/pay/123'
        };
      }
      
      throw new Error(error.response?.data?.error || error.message || 'Failed to create subscription');
    }
  }

  async confirmPayment(paymentId: number, gatewayTransactionId?: string): Promise<string> {
    try {
      const payload: any = { payment_id: paymentId };
      if (gatewayTransactionId) payload.gateway_transaction_id = gatewayTransactionId;

      const response = await paymentClient.post('/confirm-payment', payload);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to confirm payment');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to confirm payment');
    }
  }

  async getUserSubscriptions(): Promise<{
    subscriptions: UserSubscription[];
    activeSubscription: UserSubscription | null;
    count: number;
  }> {
    try {
      const response = await paymentClient.get('/my-subscriptions');
      
      if (response.data.success) {
        return {
          subscriptions: response.data.subscriptions,
          activeSubscription: response.data.active_subscription,
          count: response.data.count
        };
      } else {
        throw new Error(response.data.error || 'Failed to get subscriptions');
      }
    } catch (error: any) {
      console.error('Error fetching user subscriptions:', error);
      
      // Return empty data if API is not available
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error') || !error.response) {
        console.warn('API not available, returning empty subscription data');
        return {
          subscriptions: [],
          activeSubscription: null,
          count: 0
        };
      }
      
      throw new Error(error.response?.data?.error || error.message || 'Failed to get subscriptions');
    }
  }

  async cancelSubscription(subscriptionId: number, reason?: string): Promise<string> {
    try {
      const payload: any = { subscription_id: subscriptionId };
      if (reason) payload.reason = reason;

      const response = await paymentClient.post('/cancel-subscription', payload);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to cancel subscription');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to cancel subscription');
    }
  }

  // Utility methods
  formatPrice(price: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  }

  getPlanDuration(planType: string): string {
    switch (planType) {
      case 'daily': return '1 day';
      case 'monthly': return '1 month';
      case 'yearly': return '1 year';
      case 'custom': return 'Custom duration';
      default: return '';
    }
  }

  isSubscriptionActive(subscription: UserSubscription): boolean {
    const today = new Date();
    const endDate = new Date(subscription.end_date);
    return subscription.status === 'active' && endDate >= today;
  }

  getDaysRemaining(subscription: UserSubscription): number {
    const today = new Date();
    const endDate = new Date(subscription.end_date);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

export const paymentService = new PaymentService();
export default paymentService;