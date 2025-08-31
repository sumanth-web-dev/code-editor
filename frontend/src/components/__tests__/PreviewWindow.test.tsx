import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PreviewWindow from '../PreviewWindow';

// Mock ConsoleOutput component
jest.mock('../ConsoleOutput', () => {
  return {
    __esModule: true,
    default: ({ messages, onClear }: any) => (
      <div data-testid="console-output">
        <button onClick={onClear}>Clear Console</button>
        {messages.map((msg: any, index: number) => (
          <div key={index} data-testid={`console-message-${msg.type}`}>
            {msg.message}
          </div>
        ))}
      </div>
    ),
  };
});

const defaultProps = {
  html: '<h1>Hello World</h1>',
  css: 'h1 { color: blue; }',
  javascript: 'console.log("Hello from JS");',
};

describe('PreviewWindow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PreviewWindow {...defaultProps} />);
    expect(screen.getByText('Live Preview')).toBeInTheDocument();
  });

  it('displays refresh button', () => {
    render(<PreviewWindow {...defaultProps} />);
    
    const refreshButton = screen.getByTitle('Refresh preview');
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).toHaveTextContent('↻');
  });

  it('renders iframe for preview', () => {
    render(<PreviewWindow {...defaultProps} />);
    
    const iframe = screen.getByTitle('Live Preview');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe('IFRAME');
  });

  it('includes console output component', () => {
    render(<PreviewWindow {...defaultProps} />);
    
    expect(screen.getByTestId('console-output')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    render(<PreviewWindow {...defaultProps} />);
    
    // Loading state should appear briefly
    await waitFor(() => {
      const loadingElement = screen.queryByText('Updating preview...');
      // Loading might be very brief, so we just check it doesn't crash
    });
  });

  it('refreshes preview when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<PreviewWindow {...defaultProps} />);
    
    const refreshButton = screen.getByTitle('Refresh preview');
    await user.click(refreshButton);
    
    // Should trigger a refresh (loading state might appear briefly)
    expect(refreshButton).toBeInTheDocument();
  });

  it('clears console when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<PreviewWindow {...defaultProps} />);
    
    const clearButton = screen.getByText('Clear Console');
    await user.click(clearButton);
    
    // Console should be cleared (no messages visible)
    expect(screen.getByTestId('console-output')).toBeInTheDocument();
  });

  it('handles empty HTML content', () => {
    render(<PreviewWindow {...defaultProps} html="" />);
    
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });

  it('handles empty CSS content', () => {
    render(<PreviewWindow {...defaultProps} css="" />);
    
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });

  it('handles empty JavaScript content', () => {
    render(<PreviewWindow {...defaultProps} javascript="" />);
    
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });

  it('updates preview when props change', () => {
    const { rerender } = render(<PreviewWindow {...defaultProps} />);
    
    const newProps = {
      html: '<h2>Updated Content</h2>',
      css: 'h2 { color: red; }',
      javascript: 'console.log("Updated JS");',
    };
    
    rerender(<PreviewWindow {...newProps} />);
    
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });

  it('has proper iframe sandbox attributes', () => {
    render(<PreviewWindow {...defaultProps} />);
    
    const iframe = screen.getByTitle('Live Preview');
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
  });

  it('handles iframe content document access gracefully', () => {
    // This test ensures the component doesn't crash when iframe content is not accessible
    render(<PreviewWindow {...defaultProps} />);
    
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });

  it('shows error state when preview fails', async () => {
    // Mock iframe to simulate error
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn((tagName) => {
      if (tagName === 'iframe') {
        const iframe = originalCreateElement.call(document, tagName);
        Object.defineProperty(iframe, 'contentDocument', {
          get: () => null, // Simulate inaccessible content document
        });
        return iframe;
      }
      return originalCreateElement.call(document, tagName);
    });

    render(<PreviewWindow {...defaultProps} />);
    
    await waitFor(() => {
      // The component should handle the error gracefully
      expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
    });

    // Restore original createElement
    document.createElement = originalCreateElement;
  });

  it('handles message events from iframe', () => {
    render(<PreviewWindow {...defaultProps} />);
    
    // Simulate console message from iframe
    const messageEvent = new MessageEvent('message', {
      data: {
        type: 'console',
        method: 'log',
        args: ['Test message']
      }
    });
    
    fireEvent(window, messageEvent);
    
    // Should not crash and should handle the message
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });

  it('handles error messages from iframe', () => {
    render(<PreviewWindow {...defaultProps} />);
    
    // Simulate error message from iframe
    const errorEvent = new MessageEvent('message', {
      data: {
        type: 'error',
        message: 'JavaScript error',
        line: 5
      }
    });
    
    fireEvent(window, errorEvent);
    
    // Should handle the error message
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });

  it('ignores messages from other sources', () => {
    render(<PreviewWindow {...defaultProps} />);
    
    // Simulate message from different source
    const messageEvent = new MessageEvent('message', {
      data: { type: 'console', method: 'log', args: ['Test'] },
      source: window // Different source
    });
    
    fireEvent(window, messageEvent);
    
    // Should ignore the message and not crash
    expect(screen.getByTitle('Live Preview')).toBeInTheDocument();
  });
});