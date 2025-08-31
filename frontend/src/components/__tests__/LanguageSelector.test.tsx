import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LanguageSelector from '../LanguageSelector';
import { Language } from '../../types';

const mockLanguages: Language[] = [
  {
    id: 'python',
    name: 'Python',
    version: '3.9',
    fileExtension: '.py',
    syntaxHighlighting: 'python',
    executionCommand: 'python3'
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    version: 'ES2020',
    fileExtension: '.js',
    syntaxHighlighting: 'javascript',
    executionCommand: 'node'
  },
  {
    id: 'java',
    name: 'Java',
    version: '11',
    fileExtension: '.java',
    syntaxHighlighting: 'java',
    executionCommand: 'java'
  }
];

const defaultProps = {
  selectedLanguage: 'python',
  onLanguageChange: jest.fn(),
  supportedLanguages: mockLanguages,
};

describe('LanguageSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LanguageSelector {...defaultProps} />);
    expect(screen.getByLabelText('Language:')).toBeInTheDocument();
  });

  it('displays the language label with icon', () => {
    render(<LanguageSelector {...defaultProps} />);
    expect(screen.getByText('🔧')).toBeInTheDocument();
    expect(screen.getByText('Language:')).toBeInTheDocument();
  });

  it('renders all supported languages as options', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    mockLanguages.forEach(lang => {
      expect(screen.getByText(new RegExp(`${lang.name} ${lang.version}`))).toBeInTheDocument();
    });
  });

  it('shows the correct selected language', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const select = screen.getByDisplayValue(/Python 3.9/);
    expect(select).toBeInTheDocument();
  });

  it('calls onLanguageChange when a different language is selected', async () => {
    const user = userEvent.setup();
    const mockOnLanguageChange = jest.fn();
    
    render(<LanguageSelector {...defaultProps} onLanguageChange={mockOnLanguageChange} />);
    
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'javascript');
    
    expect(mockOnLanguageChange).toHaveBeenCalledWith('javascript');
  });

  it('displays the current language badge', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('🐍')).toBeInTheDocument();
  });

  it('updates language badge when selection changes', () => {
    const { rerender } = render(<LanguageSelector {...defaultProps} />);
    
    expect(screen.getByText('Python')).toBeInTheDocument();
    
    rerender(<LanguageSelector {...defaultProps} selectedLanguage="javascript" />);
    
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('🟨')).toBeInTheDocument();
  });

  it('applies correct language color styling', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const select = screen.getByRole('combobox');
    expect(select).toHaveStyle({ borderLeftColor: '#3776ab' }); // Python blue
  });

  it('shows correct language icons for different languages', () => {
    const iconTests = [
      { language: 'python', icon: '🐍' },
      { language: 'javascript', icon: '🟨' },
      { language: 'java', icon: '☕' },
    ];

    iconTests.forEach(({ language, icon }) => {
      const { rerender } = render(
        <LanguageSelector {...defaultProps} selectedLanguage={language} />
      );
      expect(screen.getByText(icon)).toBeInTheDocument();
      rerender(<LanguageSelector {...defaultProps} selectedLanguage="python" />);
    });
  });

  it('handles unknown language gracefully', () => {
    const unknownLanguage: Language = {
      id: 'unknown',
      name: 'Unknown',
      version: '1.0',
      fileExtension: '.unk',
      syntaxHighlighting: 'plaintext',
      executionCommand: 'unknown'
    };

    render(
      <LanguageSelector 
        {...defaultProps} 
        selectedLanguage="unknown"
        supportedLanguages={[...mockLanguages, unknownLanguage]}
      />
    );
    
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('📄')).toBeInTheDocument(); // Default icon
  });

  it('has proper accessibility attributes', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('id', 'language-select');
    
    const label = screen.getByLabelText('Language:');
    expect(label).toBeInTheDocument();
  });

  it('displays language indicator with correct color', () => {
    render(<LanguageSelector {...defaultProps} />);
    
    const indicator = document.querySelector('.language-indicator');
    expect(indicator).toHaveStyle({ backgroundColor: '#3776ab' });
  });
});