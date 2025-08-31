import React, { useState, useEffect } from 'react';
import analysisService, { UsageInfo } from '../services/analysisService';
import './AnalysisButton.css';

interface AnalysisButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const AnalysisButton: React.FC<AnalysisButtonProps> = ({ onClick, disabled = false }) => {
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    loadUsageInfo();
  }, []);

  const loadUsageInfo = async () => {
    try {
      const response = await analysisService.getUsageInfo();
      if (response.success && response.usage_info) {
        setUsageInfo(response.usage_info);
      }
    } catch (error) {
      console.error('Failed to load usage info:', error);
    }
  };

  const handleClick = () => {
    if (!disabled && usageInfo?.can_use_feature) {
      onClick();
    }
  };

  const getButtonText = () => {
    if (!usageInfo) return 'AI Analysis';
    
    if (usageInfo.is_premium) {
      return 'AI Analysis';
    }
    
    if (usageInfo.remaining_free > 0) {
      return `AI Analysis (${usageInfo.remaining_free} left)`;
    }
    
    return 'AI Analysis (Upgrade)';
  };

  const getTooltipText = () => {
    if (!usageInfo) return 'Loading...';
    
    if (usageInfo.is_premium) {
      return 'Unlimited AI-powered code analysis and generation';
    }
    
    if (usageInfo.remaining_free > 0) {
      return `${usageInfo.remaining_free} free uses remaining. Click to analyze your code with AI.`;
    }
    
    return 'Free trial limit reached. Upgrade to premium for unlimited access.';
  };

  const isButtonDisabled = disabled || !usageInfo?.can_use_feature;

  return (
    <div className="analysis-button-container">
      <button
        className={`analysis-button ${usageInfo?.is_premium ? 'premium' : ''} ${isButtonDisabled ? 'disabled' : ''}`}
        onClick={handleClick}
        disabled={isButtonDisabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={getTooltipText()}
      >
        <span className="button-icon">🤖</span>
        <span className="button-text">{getButtonText()}</span>
        {usageInfo?.is_premium && <span className="premium-star">⭐</span>}
      </button>
      
      {showTooltip && (
        <div className="analysis-tooltip">
          {getTooltipText()}
        </div>
      )}
    </div>
  );
};

export default AnalysisButton;