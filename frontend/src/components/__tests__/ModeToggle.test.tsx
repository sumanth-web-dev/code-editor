import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ModeToggle from '../ModeToggle';

const defaultProps = {
  currentMode: 'execution' as const,
  onModeChange: jest.fn(),
  isPreviewAvailable: true,
  language: 'javascript',
};

describe('ModeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ModeToggle {...defaultProps} />);
    expect(screen.getByText('Execute')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('shows active state for current mode', () => {
    render(<ModeToggle {...defaultProps} currentMode="execution" />);
    
    const executeButton = screen.getByText('Execute').closest('button');
    const previewButton = screen.getByText('Preview').closest('button');
    
    expect(executeButton).toHaveClass('active');
    expect(previewButton).not.toHaveClass('active');
  });

  it('switches active state when mode changes', () => {
    const { rerender } = render(<ModeToggle {...defaultProps} currentMode="execution" />);
    
    rerender(<ModeToggle {...defaultProps} currentMode="preview" />);
    
    const executeButton = screen.getByText('Execute').closest('button');
    const previewButton = screen.getByText('Preview').closest('button');
    
    expect(executeButton).not.toHaveClass('active');
    expect(previewButton).toHaveClass('active');
  });

  it('calls onModeChange when execute button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnModeChange = jest.fn();
    
    render(<ModeToggle {...defaultProps} onModeChange={mockOnModeChange} />);
    
    const executeButton = screen.getByText('Execute').closest('button');
    await user.click(executeButton!);
    
    expect(mockOnModeChange).toHaveBeenCalledWith('execution');
  });

  it('calls onModeChange when preview button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnModeChange = jest.fn();
    
    render(<ModeToggle {...defaultProps} onModeChange={mockOnModeChange} />);
    
    const previewButton = screen.getByText('Preview').closest('button');
    await user.click(previewButton!);
    
    expect(mockOnModeChange).toHaveBeenCalledWith('preview');
  });

  it('disables preview button when preview is not available', () => {
    render(<ModeToggle {...defaultProps} isPreviewAvailable={false} />);
    
    const previewButton = screen.getByText('Preview').closest('button');
    expect(previewButton).toBeDisabled();
  });

  it('enables preview button when preview is available', () => {
    render(<ModeToggle {...defaultProps} isPreviewAvailable={true} />);
    
    const previewButton = screen.getByText('Preview').closest('button');
    expect(previewButton).not.toBeDisabled();
  });

  it('shows correct tooltips', () => {
    render(<ModeToggle {...defaultProps} />);
    
    const executeButton = screen.getByTitle('Code execution mode');
    const previewButton = screen.getByTitle('Live preview mode');
    
    expect(executeButton).toBeInTheDocument();
    expect(previewButton).toBeInTheDocument();
  });

  it('shows disabled tooltip when preview is not available', () => {
    render(<ModeToggle {...defaultProps} isPreviewAvailable={false} />);
    
    const previewButton = screen.getByTitle('Preview not available for this language');
    expect(previewButton).toBeInTheDocument();
  });

  it('displays mode icons', () => {
    render(<ModeToggle {...defaultProps} />);
    
    expect(screen.getByText('⚡')).toBeInTheDocument(); // Execute icon
    expect(screen.getByText('👁️')).toBeInTheDocument(); // Preview icon
  });

  it('shows mode info when in preview mode', () => {
    render(<ModeToggle {...defaultProps} currentMode="preview" language="html" />);
    
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
    expect(screen.getByText('Live preview mode - changes update in real-time')).toBeInTheDocument();
  });

  it('does not show mode info when in execution mode', () => {
    render(<ModeToggle {...defaultProps} currentMode="execution" />);
    
    expect(screen.queryByText('ℹ️')).not.toBeInTheDocument();
  });

  it('shows different info text for frontend languages', () => {
    render(<ModeToggle {...defaultProps} currentMode="preview" language="html" />);
    
    expect(screen.getByText('Live preview mode - changes update in real-time')).toBeInTheDocument();
  });

  it('shows different info text for non-frontend languages', () => {
    render(<ModeToggle {...defaultProps} currentMode="preview" language="python" />);
    
    expect(screen.getByText('Preview mode - showing rendered output')).toBeInTheDocument();
  });

  it('does not render when preview is not available for non-frontend language', () => {
    const { container } = render(
      <ModeToggle 
        {...defaultProps} 
        language="python" 
        isPreviewAvailable={false} 
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders for frontend languages even when preview is not available', () => {
    render(
      <ModeToggle 
        {...defaultProps} 
        language="html" 
        isPreviewAvailable={false} 
      />
    );
    
    expect(screen.getByText('Execute')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('identifies frontend languages correctly', () => {
    const frontendLanguages = ['html', 'css', 'javascript'];
    
    frontendLanguages.forEach(lang => {
      const { rerender } = render(
        <ModeToggle 
          {...defaultProps} 
          language={lang} 
          isPreviewAvailable={false} 
        />
      );
      
      // Should still render for frontend languages
      expect(screen.getByText('Execute')).toBeInTheDocument();
      
      rerender(<ModeToggle {...defaultProps} language="python" />);
    });
  });
});