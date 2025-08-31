import React from 'react';
import './ModeToggle.css';

interface ModeToggleProps {
  currentMode: 'execution' | 'preview';
  onModeChange: (mode: 'execution' | 'preview') => void;
  isPreviewAvailable: boolean;
  language: string;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ 
  currentMode, 
  onModeChange, 
  isPreviewAvailable,
  language 
}) => {
  const isFrontendLanguage = ['html', 'css', 'javascript'].includes(language.toLowerCase());

  if (!isFrontendLanguage && !isPreviewAvailable) {
    return null;
  }

  return (
    <div className="mode-toggle">
      <div className="mode-toggle-container">
        <button
          className={`mode-button ${currentMode === 'execution' ? 'active' : ''}`}
          onClick={() => onModeChange('execution')}
          title="Code execution mode"
        >
          <span className="mode-icon">⚡</span>
          <span className="mode-label">Execute</span>
        </button>
        
        <button
          className={`mode-button ${currentMode === 'preview' ? 'active' : ''}`}
          onClick={() => onModeChange('preview')}
          disabled={!isPreviewAvailable}
          title={isPreviewAvailable ? 'Live preview mode' : 'Preview not available for this language'}
        >
          <span className="mode-icon">👁️</span>
          <span className="mode-label">Preview</span>
        </button>
      </div>
      
      {currentMode === 'preview' && (
        <div className="mode-info">
          <span className="info-icon">ℹ️</span>
          <span className="info-text">
            {isFrontendLanguage 
              ? 'Live preview mode - changes update in real-time'
              : 'Preview mode - showing rendered output'
            }
          </span>
        </div>
      )}
    </div>
  );
};

export default ModeToggle;