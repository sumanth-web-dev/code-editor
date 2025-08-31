// Payment Gateway Configuration
export const paymentConfig = {
  // Stripe Configuration
  stripe: {
    publishableKey: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
    apiVersion: '2023-10-16' as const,
    currency: 'usd',
    locale: 'en' as const,
  },

  // Razorpay Configuration
  razorpay: {
    keyId: process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_...',
    currency: 'INR',
    theme: {
      color: '#3b82f6',
    },
  },

  // PayPal Configuration
  paypal: {
    clientId: process.env.REACT_APP_PAYPAL_CLIENT_ID || 'sb-...',
    currency: 'USD',
    intent: 'capture' as const,
  },

  // General Payment Settings
  general: {
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR'],
    taxRate: 0.1, // 10% tax
    processingFee: 0.029, // 2.9% processing fee
  },

  // Feature Flags
  features: {
    enableStripe: true,
    enableRazorpay: true,
    enablePayPal: false,
    enableCrypto: false,
    enableBankTransfer: false,
  },

  // Subscription Plans Configuration
  plans: {
    free: {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'month',
      features: [
        '5 documents per month',
        'Basic code execution',
        'Community support',
        '100MB storage'
      ],
      limits: {
        documentsPerMonth: 5,
        aiRequestsPerMonth: 10,
        storageLimit: 100, // MB
        executionTimeLimit: 30, // seconds
      }
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      price: 9.99,
      interval: 'month',
      features: [
        'Unlimited documents',
        'Advanced code execution',
        'Priority support',
        '10GB storage',
        'AI-powered code analysis',
        'Export to multiple formats'
      ],
      limits: {
        documentsPerMonth: -1, // unlimited
        aiRequestsPerMonth: 1000,
        storageLimit: 10240, // MB
        executionTimeLimit: 300, // seconds
      }
    },
    premium: {
      id: 'premium',
      name: 'Premium',
      price: 19.99,
      interval: 'month',
      features: [
        'Everything in Pro',
        'Team collaboration',
        'Advanced analytics',
        '100GB storage',
        'Custom integrations',
        'Dedicated support',
        'White-label options'
      ],
      limits: {
        documentsPerMonth: -1, // unlimited
        aiRequestsPerMonth: 10000,
        storageLimit: 102400, // MB
        executionTimeLimit: 600, // seconds
        teamMembers: 10,
      }
    }
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
  // Production payment keys should be set via environment variables
  console.log('Using production payment configuration');
} else {
  // Development/test mode
  console.log('Using development payment configuration');
}

export default paymentConfig;