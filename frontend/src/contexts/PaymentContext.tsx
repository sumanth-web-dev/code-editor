import React, { createContext, useContext, ReactNode } from 'react';
import { usePayments } from '../hooks/usePayments';
import { 
  PaymentState, 
  SubscriptionPlan, 
  UserSubscription, 
  CostCalculation, 
  PaymentData 
} from '../types';

interface PaymentContextType extends PaymentState {
  loadPlans: () => Promise<SubscriptionPlan[]>;
  loadUserSubscriptions: () => Promise<any>;
  calculateCost: (
    planId: number,
    startDate?: string,
    endDate?: string,
    durationDays?: number
  ) => Promise<CostCalculation>;
  createSubscription: (
    planId: number,
    startDate?: string,
    endDate?: string,
    durationDays?: number,
    paymentGateway?: string
  ) => Promise<PaymentData>;
  confirmPayment: (paymentId: number, gatewayTransactionId?: string) => Promise<string>;
  cancelSubscription: (subscriptionId: number, reason?: string) => Promise<string>;
  clearError: () => void;
  getPlanById: (planId: number) => SubscriptionPlan | undefined;
  hasActiveSubscription: () => boolean;
  getSubscriptionStatus: () => {
    hasSubscription: boolean;
    isActive: boolean;
    daysRemaining: number;
    subscription: UserSubscription | null;
  };
  formatPrice: (price: number, currency?: string) => string;
  getPlanDuration: (planType: string) => string;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

interface PaymentProviderProps {
  children: ReactNode;
}

export const PaymentProvider: React.FC<PaymentProviderProps> = ({ children }) => {
  const payments = usePayments();

  return (
    <PaymentContext.Provider value={payments}>
      {children}
    </PaymentContext.Provider>
  );
};

export const usePaymentContext = (): PaymentContextType => {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePaymentContext must be used within a PaymentProvider');
  }
  return context;
};

export default PaymentContext;