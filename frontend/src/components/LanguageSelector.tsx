import React from 'react';
import { LanguageSelectorProps } from '../types';
import './LanguageSelector.css';

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onLanguageChange,
  supportedLanguages
}) => {
  // Language-specific color schemes
  const getLanguageColor = (languageId: string): string => {
    const colorMap: { [key: string]: string } = {
      'python': '#3776ab',
      'javascript': '#f7df1e',
      'java': '#ed8b00',
      'cpp': '#00599c',
      'c': '#a8b9cc',
      'csharp': '#239120',
      'php': '#777bb4',
      'ruby': '#cc342d',
      'go': '#00add8',
      'rust': '#000000',
      'r': '#276dc3',
      'typescript': '#3178c6',
      'html': '#e34f26',
      'css': '#1572b6'
    };
    return colorMap[languageId] || '#6c757d';
  };

  // Get language icon/symbol
  const getLanguageIcon = (languageId: string): string => {
    const iconMap: { [key: string]: string } = {
      'python': '🐍',
      'javascript': '🟨',
      'java': '☕',
      'cpp': '⚡',
      'c': '🔧',
      'csharp': '#️⃣',
      'php': '🐘',
      'ruby': '💎',
      'go': '🐹',
      'rust': '🦀',
      'r': '📊',
      'typescript': '🔷',
      'html': '🌐',
      'css': '🎨'
    };
    return iconMap[languageId] || '📄';
  };

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onLanguageChange(event.target.value);
  };

  return (
    <div className="language-selector">
      <label htmlFor="language-select" className="language-label">
        <span className="label-icon">🔧</span>
        Language:
      </label>
      <div className="select-wrapper">
        <select
          id="language-select"
          value={selectedLanguage}
          onChange={handleLanguageChange}
          className="language-select"
          style={{
            borderLeftColor: getLanguageColor(selectedLanguage)
          }}
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {getLanguageIcon(lang.id)} {lang.name} {lang.version}
            </option>
          ))}
        </select>
        <div
          className="language-indicator"
          style={{ backgroundColor: getLanguageColor(selectedLanguage) }}
        />
      </div>
      <div className="language-info">
        <span className="current-language-badge">
          <span className="language-icon">
            {getLanguageIcon(selectedLanguage)}
          </span>
          <span className="language-name">
            {supportedLanguages.find(lang => lang.id === selectedLanguage)?.name || selectedLanguage}
          </span>
        </span>
      </div>
    </div>
  );
};

export default LanguageSelector;