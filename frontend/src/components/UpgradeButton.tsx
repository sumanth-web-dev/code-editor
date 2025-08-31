import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { paymentService } from '../services/paymentService';
import { UserSubscription } from '../types';
import './UpgradeButton.css';

interface UpgradeButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'inline';
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({ 
  className = '', 
  variant = 'header' 
}) => {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isAuthenticated || !user) {
        setLoading(false);
        return;
      }

      try {
        const subscriptionsData = await paymentService.getUserSubscriptions();
        const activeSubscription = subscriptionsData.subscriptions.find((sub: any) => sub.status === 'active');
        setSubscription(activeSubscription || null);
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [isAuthenticated, user]);

  if (!isAuthenticated || loading) {
    return null;
  }

  const handleUpgradeClick = () => {
    window.location.href = '/subscriptions';
  };

  const isPremium = subscription && subscription.status === 'active';
  const isBasicPlan = subscription?.plan?.name?.toLowerCase().includes('basic');

  // Don't show button if user has premium plan (not basic)
  if (isPremium && !isBasicPlan) {
    return null;
  }

  const getButtonText = () => {
    if (!subscription) {
      return 'Upgrade to Premium';
    }
    if (isBasicPlan) {
      return 'Upgrade Plan';
    }
    return 'Choose Plan';
  };

  const getButtonIcon = () => {
    if (variant === 'header') {
      return '⭐';
    }
    return '🚀';
  };

  return (
    <button
      className={`upgrade-button ${variant} ${className}`}
      onClick={handleUpgradeClick}
      title={getButtonText()}
    >
      <span className="upgrade-icon">{getButtonIcon()}</span>
      <span className="upgrade-text">{getButtonText()}</span>
      {!subscription && (
        <span className="upgrade-badge">New</span>
      )}
    </button>
  );
};

export default UpgradeButton;