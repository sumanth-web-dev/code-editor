import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import OutputWindow from '../OutputWindow';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

const defaultProps = {
  output: '',
  isLoading: false,
  error: undefined,
};

describe('OutputWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<OutputWindow {...defaultProps} />);
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(<OutputWindow {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Executing...')).toBeInTheDocument();
    expect(screen.getByText('Executing code...')).toBeInTheDocument();
    expect(document.querySelector('.loading-dots')).toBeInTheDocument();
  });

  it('displays output when provided', () => {
    const output = 'Hello, World!\nThis is test output';
    render(<OutputWindow {...defaultProps} output={output} />);
    
    expect(screen.getByText('Output:')).toBeInTheDocument();
    expect(screen.getByText(output)).toBeInTheDocument();
  });

  it('displays error message when error is provided', () => {
    const error = 'SyntaxError: invalid syntax';
    render(<OutputWindow {...defaultProps} error={error} />);
    
    expect(screen.getByText('Execution Error')).toBeInTheDocument();
    expect(screen.getByText(error)).toBeInTheDocument();
  });

  it('shows "No output yet" message when no output and not loading', () => {
    render(<OutputWindow {...defaultProps} />);
    
    expect(screen.getByText('No output yet')).toBeInTheDocument();
    expect(screen.getByText('Run your code to see results here')).toBeInTheDocument();
  });

  it('shows copy button when output is available', () => {
    const output = 'Hello, World!';
    render(<OutputWindow {...defaultProps} output={output} />);
    
    const copyButton = screen.getByTitle('Copy output to clipboard');
    expect(copyButton).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('copies output to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    const output = 'Hello, World!';
    const mockWriteText = jest.fn();
    navigator.clipboard.writeText = mockWriteText;
    
    render(<OutputWindow {...defaultProps} output={output} />);
    
    const copyButton = screen.getByTitle('Copy output to clipboard');
    await user.click(copyButton);
    
    expect(mockWriteText).toHaveBeenCalledWith(output);
  });

  it('does not show copy button when no output', () => {
    render(<OutputWindow {...defaultProps} />);
    
    expect(screen.queryByTitle('Copy output to clipboard')).not.toBeInTheDocument();
  });

  it('does not show copy button when loading', () => {
    render(<OutputWindow {...defaultProps} isLoading={true} />);
    
    expect(screen.queryByTitle('Copy output to clipboard')).not.toBeInTheDocument();
  });

  it('does not show copy button when error is displayed', () => {
    render(<OutputWindow {...defaultProps} error="Some error" />);
    
    expect(screen.queryByTitle('Copy output to clipboard')).not.toBeInTheDocument();
  });

  it('displays loading indicator in header when loading', () => {
    render(<OutputWindow {...defaultProps} isLoading={true} />);
    
    const headerLoadingIndicator = document.querySelector('.loading-indicator-small');
    expect(headerLoadingIndicator).toBeInTheDocument();
    expect(screen.getByText('Executing...')).toBeInTheDocument();
  });

  it('preserves output formatting with pre tag', () => {
    const output = 'Line 1\nLine 2\n  Indented line';
    render(<OutputWindow {...defaultProps} output={output} />);
    
    const preElement = screen.getByText(output);
    expect(preElement.tagName).toBe('PRE');
    expect(preElement).toHaveClass('code-output');
  });

  it('shows error icon in error state', () => {
    render(<OutputWindow {...defaultProps} error="Test error" />);
    
    const errorIcon = document.querySelector('.error-icon');
    expect(errorIcon).toBeInTheDocument();
  });

  it('shows no-output icon when no output', () => {
    render(<OutputWindow {...defaultProps} />);
    
    const noOutputIcon = document.querySelector('.no-output-icon');
    expect(noOutputIcon).toBeInTheDocument();
  });

  it('handles multiline output correctly', () => {
    const multilineOutput = `Line 1
Line 2
Line 3
  Indented line
    Double indented`;
    
    render(<OutputWindow {...defaultProps} output={multilineOutput} />);
    
    expect(screen.getByText(multilineOutput)).toBeInTheDocument();
  });

  it('handles empty string output', () => {
    render(<OutputWindow {...defaultProps} output="" />);
    
    // Empty string should still show the "No output yet" state
    expect(screen.getByText('No output yet')).toBeInTheDocument();
  });

  it('prioritizes error display over output', () => {
    const output = 'Some output';
    const error = 'Some error';
    
    render(<OutputWindow {...defaultProps} output={output} error={error} />);
    
    expect(screen.getByText('Execution Error')).toBeInTheDocument();
    expect(screen.getByText(error)).toBeInTheDocument();
    expect(screen.queryByText(output)).not.toBeInTheDocument();
  });

  it('prioritizes loading state over output and error', () => {
    const output = 'Some output';
    const error = 'Some error';
    
    render(<OutputWindow {...defaultProps} output={output} error={error} isLoading={true} />);
    
    expect(screen.getByText('Executing code...')).toBeInTheDocument();
    expect(screen.queryByText(output)).not.toBeInTheDocument();
    expect(screen.queryByText(error)).not.toBeInTheDocument();
  });
});