import { useState, useEffect, useCallback } from 'react';
import { 
  SubscriptionPlan, 
  UserSubscription, 
  PaymentState, 
  CostCalculation, 
  PaymentData,
  UsageStats
} from '../types';
import { transformUserSubscriptions } from '../utils/dataTransformers';
import { paymentService } from '../services/paymentService';
import axios from 'axios';

export const usePayments = () => {
  const [paymentState, setPaymentState] = useState<PaymentState>({
    plans: [],
    userSubscriptions: [],
    activeSubscription: null,
    loading: false,
    error: null,
  });
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [usageStats, setUsageStats] = useState({ documentsCreated: 0, aiRequests: 0, storageUsed: 0 });

  // Load subscription plans
  const loadPlans = useCallback(async () => {
    setPaymentState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const plans = await paymentService.getSubscriptionPlans();
      setPaymentState(prev => ({
        ...prev,
        plans,
        loading: false,
      }));
      return plans;
    } catch (error: any) {
      console.error('Error loading plans:', error);
      setPaymentState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      // Don't throw error to prevent runtime crashes
      return [];
    }
  }, []);

  // Load user subscriptions
  const loadUserSubscriptions = useCallback(async () => {
    setPaymentState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await paymentService.getUserSubscriptions();
      const transformedSubscriptions = transformUserSubscriptions(result.subscriptions);
      const transformedActiveSubscription = result.activeSubscription 
        ? transformUserSubscriptions([result.activeSubscription])[0] 
        : null;
      
      setPaymentState(prev => ({
        ...prev,
        userSubscriptions: transformedSubscriptions,
        activeSubscription: transformedActiveSubscription,
        loading: false,
      }));
      return {
        ...result,
        subscriptions: transformedSubscriptions,
        activeSubscription: transformedActiveSubscription
      };
    } catch (error: any) {
      setPaymentState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      throw error;
    }
  }, []);

  // Calculate subscription cost
  const calculateCost = useCallback(async (
    planId: number,
    startDate?: string,
    endDate?: string,
    durationDays?: number
  ): Promise<CostCalculation> => {
    try {
      return await paymentService.calculateCost(planId, startDate, endDate, durationDays);
    } catch (error: any) {
      setPaymentState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, []);

  // Create subscription
  const createSubscription = useCallback(async (
    planId: string | number,
    startDate?: string,
    endDate?: string,
    durationDays?: number,
    paymentGateway?: string
  ): Promise<PaymentData> => {
    setPaymentState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Ensure planId is a number
      const numericPlanId = typeof planId === 'string' ? parseInt(planId) : planId;
      if (isNaN(numericPlanId)) {
        throw new Error('Invalid plan ID');
      }
      
      const result = await paymentService.createSubscription(
        numericPlanId,
        startDate,
        endDate,
        durationDays,
        paymentGateway
      );
      
      // Refresh user subscriptions after creating new one
      await loadUserSubscriptions();
      
      return result;
    } catch (error: any) {
      setPaymentState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      throw error;
    }
  }, [loadUserSubscriptions]);

  // Confirm payment
  const confirmPayment = useCallback(async (
    paymentId: number,
    gatewayTransactionId?: string
  ): Promise<string> => {
    setPaymentState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await paymentService.confirmPayment(paymentId, gatewayTransactionId);
      
      // Refresh user subscriptions after payment confirmation
      await loadUserSubscriptions();
      
      setPaymentState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error: any) {
      setPaymentState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      throw error;
    }
  }, [loadUserSubscriptions]);

  // Cancel subscription
  const cancelSubscription = useCallback(async (
    subscriptionId: number,
    reason?: string
  ): Promise<string> => {
    setPaymentState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await paymentService.cancelSubscription(subscriptionId, reason);
      
      // Refresh user subscriptions after cancellation
      await loadUserSubscriptions();
      
      setPaymentState(prev => ({ ...prev, loading: false }));
      return result;
    } catch (error: any) {
      setPaymentState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
      throw error;
    }
  }, [loadUserSubscriptions]);

  // Clear error
  const clearError = useCallback(() => {
    setPaymentState(prev => ({ ...prev, error: null }));
  }, []);

  // Initialize data on mount
  useEffect(() => {
    const initializePayments = async () => {
      try {
        await loadPlans();
      } catch (error) {
        console.error('Failed to initialize payment plans:', error);
        // Don't throw error, just log it
      }
    };
    
    initializePayments();
  }, [loadPlans]);

  // Fetch payment history
  const loadPaymentHistory = useCallback(async () => {
    try {
      // Replace with your backend endpoint for payment history
      const response = await axios.get('/temp_payments/payment-history');
      setPaymentHistory(response.data.history || []);
    } catch (error) {
      setPaymentHistory([]);
    }
  }, []);

  // Fetch usage stats
  const loadUsageStats = useCallback(async () => {
    try {
      // Replace with your backend endpoint for usage stats
      const response = await axios.get('/user/usage');
      setUsageStats(response.data.stats || { documentsCreated: 0, aiRequests: 0, storageUsed: 0 });
    } catch (error) {
      setUsageStats({ documentsCreated: 0, aiRequests: 0, storageUsed: 0 });
    }
  }, []);

  useEffect(() => {
    loadPaymentHistory();
    loadUsageStats();
  }, [loadPaymentHistory, loadUsageStats]);

  // Utility methods
  const getPlanById = useCallback((planId: string | number): SubscriptionPlan | undefined => {
    return paymentState.plans.find(plan => plan.id === planId.toString());
  }, [paymentState.plans]);

  const hasActiveSubscription = useCallback((): boolean => {
    return !!paymentState.activeSubscription && 
           paymentService.isSubscriptionActive(paymentState.activeSubscription);
  }, [paymentState.activeSubscription]);

  const getSubscriptionStatus = useCallback((): {
    hasSubscription: boolean;
    isActive: boolean;
    daysRemaining: number;
    subscription: UserSubscription | null;
  } => {
    const subscription = paymentState.activeSubscription;
    
    if (!subscription) {
      return {
        hasSubscription: false,
        isActive: false,
        daysRemaining: 0,
        subscription: null,
      };
    }

    const isActive = paymentService.isSubscriptionActive(subscription);
    const daysRemaining = paymentService.getDaysRemaining(subscription);

    return {
      hasSubscription: true,
      isActive,
      daysRemaining,
      subscription,
    };
  }, [paymentState.activeSubscription]);

  const formatPrice = useCallback((price: number, currency: string = 'USD'): string => {
    return paymentService.formatPrice(price, currency);
  }, []);

  const getPlanDuration = useCallback((planType: string): string => {
    return paymentService.getPlanDuration(planType);
  }, []);

  return {
    // State
    ...paymentState,
    subscription: paymentState.activeSubscription,
    plans: paymentState.plans,
    paymentHistory,
    usageStats,
    
    // Actions
    loadPlans,
    loadUserSubscriptions,
    calculateCost,
    createSubscription,
    confirmPayment,
    cancelSubscription,
    clearError,
    
    // Utilities
    getPlanById,
    hasActiveSubscription,
    getSubscriptionStatus,
    formatPrice,
    getPlanDuration,
  };
};

export default usePayments;