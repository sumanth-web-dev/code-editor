import { UserSubscription } from '../types';

// Transform UserSubscription to include computed properties for compatibility
export const transformUserSubscription = (subscription: any): UserSubscription => {
  return {
    ...subscription,
    // Add computed properties for compatibility
    createdAt: subscription.created_at,
    expiresAt: subscription.end_date,
    amount: subscription.total_amount,
    planId: subscription.plan_id,
  };
};

// Transform array of subscriptions
export const transformUserSubscriptions = (subscriptions: any[]): UserSubscription[] => {
  return subscriptions.map(transformUserSubscription);
};

// Transform plan name for display
export const formatPlanName = (planName: string | undefined): string => {
  if (!planName) return 'Free';
  return planName.charAt(0).toUpperCase() + planName.slice(1);
};

// Format currency amount for INR
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

// Format date for display
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};