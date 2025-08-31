import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../App';
import ApiService from '../services/api';

// Mock ApiService
jest.mock('../services/api');
const mockApiService = ApiService as jest.Mocked<typeof ApiService>;

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => {
  const mockReact = require('react');
  return {
    __esModule: true,
    default: ({ onChange, onMount, value }: any) => {
      mockReact.useEffect(() => {
        if (onMount) {
          const mockEditor = {
            updateOptions: jest.fn(),
            addCommand: jest.fn(),
            focus: jest.fn(),
            getOption: jest.fn(() => 'on'),
            trigger: jest.fn(),
          };
          const mockMonaco = {
            KeyMod: { CtrlCmd: 1, Alt: 2, Shift: 4 },
            KeyCode: { 
              Enter: 3, KeyS: 19, Slash: 85, KeyD: 20, 
              UpArrow: 16, DownArrow: 18, KeyF: 21, KeyG: 22, KeyZ: 26 
            },
            editor: { EditorOption: { wordWrap: 'wordWrap' } }
          };
          onMount(mockEditor, mockMonaco);
        }
      }, [onMount]);

      return mockReact.createElement('div', { 'data-testid': 'monaco-editor' },
        mockReact.createElement('textarea', {
          'data-testid': 'editor-textarea',
          value: value,
          onChange: (e: any) => onChange && onChange(e.target.value)
        })
      );
    },
  };
});

// Mock errorLogger
jest.mock('../services/errorLogger', () => ({
  __esModule: true,
  default: {
    logApiError: jest.fn(),
    logReactError: jest.fn(),
  },
}));

const mockLanguages = [
  {
    id: 'python',
    name: 'Python',
    version: '3.9',
    fileExtension: '.py',
    syntaxHighlighting: 'python',
    executionCommand: 'python3',
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    version: 'ES2020',
    fileExtension: '.js',
    syntaxHighlighting: 'javascript',
    executionCommand: 'node',
  },
  {
    id: 'html',
    name: 'HTML',
    version: '5',
    fileExtension: '.html',
    syntaxHighlighting: 'html',
    executionCommand: 'preview',
  },
];

describe('App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiService.healthCheck.mockResolvedValue(true);
    mockApiService.getLanguages.mockResolvedValue(mockLanguages);
  });

  describe('Complete User Workflows', () => {
    it('completes a full code execution workflow', async () => {
      const user = userEvent.setup();
      
      // Mock successful code execution
      mockApiService.executeCode.mockResolvedValue({
        output: 'Hello, World!\nHello, Developer!\n',
        executionTime: 0.123,
      });

      render(<App />);

      // Wait for app to load
      await waitFor(() => {
        expect(screen.getByText('PYTHON')).toBeInTheDocument();
      });

      // Verify initial state
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByDisplayValue('python')).toBeInTheDocument();

      // Modify code
      const codeTextarea = screen.getByTestId('editor-textarea');
      await user.clear(codeTextarea);
      await user.type(codeTextarea, 'print("Hello from integration test!")');

      // Add user input
      const inputTextarea = screen.getByPlaceholderText(/Enter input values here/);
      await user.type(inputTextarea, 'test input');

      // Execute code
      const runButton = screen.getByText('Run Code');
      await user.click(runButton);

      // Verify execution
      await waitFor(() => {
        expect(screen.getByText('Hello, World!')).toBeInTheDocument();
      });

      expect(mockApiService.executeCode).toHaveBeenCalledWith({
        language: 'python',
        code: 'print("Hello from integration test!")',
        input: 'test input',
      });
    });

    it('completes a language switching workflow', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('PYTHON')).toBeInTheDocument();
      });

      // Switch to JavaScript
      const languageSelect = screen.getByDisplayValue('python');
      await user.selectOptions(languageSelect, 'javascript');

      // Verify language switch
      expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
      expect(screen.getByText(/Welcome to JavaScript!/)).toBeInTheDocument();

      // Switch to HTML
      await user.selectOptions(languageSelect, 'html');

      // Verify HTML mode and preview availability
      expect(screen.getByText('HTML')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('completes a preview mode workflow', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('python')).toBeInTheDocument();
      });

      // Switch to HTML
      const languageSelect = screen.getByDisplayValue('python');
      await user.selectOptions(languageSelect, 'html');

      // Switch to preview mode
      const previewButton = screen.getByText('Preview');
      await user.click(previewButton);

      // Verify preview mode is active
      expect(previewButton).toHaveClass('active');
      expect(screen.getByTitle('Live Preview')).toBeInTheDocument();

      // Switch back to execution mode
      const executeButton = screen.getByText('Execute');
      await user.click(executeButton);

      // Verify execution mode is active
      expect(executeButton).toHaveClass('active');
      expect(screen.getByText('Output')).toBeInTheDocument();
    });

    it('handles error recovery workflow', async () => {
      const user = userEvent.setup();
      
      // Start with connection failure
      mockApiService.healthCheck.mockResolvedValueOnce(false);
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });

      // Verify error state
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Run Code')).toBeDisabled();

      // Mock successful reconnection
      mockApiService.healthCheck.mockResolvedValueOnce(true);

      // Retry connection
      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      // Verify recovery
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      expect(screen.getByText('Run Code')).not.toBeDisabled();
    });

    it('handles code execution error and recovery', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Run Code')).toBeInTheDocument();
      });

      // Mock execution error
      mockApiService.executeCode.mockRejectedValueOnce(
        new Error('SyntaxError: invalid syntax on line 1')
      );

      // Execute code with error
      const runButton = screen.getByText('Run Code');
      await user.click(runButton);

      // Verify error display
      await waitFor(() => {
        expect(screen.getByText(/SyntaxError: invalid syntax/)).toBeInTheDocument();
      });

      // Fix code and try again
      mockApiService.executeCode.mockResolvedValueOnce({
        output: 'Fixed code output',
        executionTime: 0.1,
      });

      const codeTextarea = screen.getByTestId('editor-textarea');
      await user.clear(codeTextarea);
      await user.type(codeTextarea, 'print("Fixed code")');

      await user.click(runButton);

      // Verify successful execution
      await waitFor(() => {
        expect(screen.getByText('Fixed code output')).toBeInTheDocument();
      });

      // Verify error is cleared
      expect(screen.queryByText(/SyntaxError/)).not.toBeInTheDocument();
    });

    it('handles editor settings workflow', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTitle('Editor Settings')).toBeInTheDocument();
      });

      // Open settings
      const settingsButton = screen.getByTitle('Editor Settings');
      await user.click(settingsButton);

      // Verify settings panel
      expect(screen.getByText('Editor Settings')).toBeInTheDocument();
      expect(screen.getByText('Theme')).toBeInTheDocument();
      expect(screen.getByText('Font Size')).toBeInTheDocument();

      // Change theme
      const themeSelect = screen.getByDisplayValue('Dark');
      await user.selectOptions(themeSelect, 'vs-light');

      // Change font size
      const fontSizeSlider = screen.getByDisplayValue('14');
      await user.clear(fontSizeSlider);
      await user.type(fontSizeSlider, '16');

      // Verify changes
      expect(themeSelect).toHaveValue('vs-light');
      expect(screen.getByText('16px')).toBeInTheDocument();

      // Close settings
      const closeButton = screen.getByText('×');
      await user.click(closeButton);

      // Verify settings panel is closed
      expect(screen.queryByText('Editor Settings')).not.toBeInTheDocument();
    });

    it('handles keyboard shortcuts workflow', async () => {
      const user = userEvent.setup();
      
      mockApiService.executeCode.mockResolvedValue({
        output: 'Keyboard shortcut execution',
        executionTime: 0.1,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument();
      });

      // Test Ctrl+Enter shortcut
      const codeTextarea = screen.getByTestId('editor-textarea');
      await user.click(codeTextarea); // Focus the textarea

      // Simulate Ctrl+Enter on document (as the shortcut is bound to document)
      fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });

      // Verify code execution
      await waitFor(() => {
        expect(mockApiService.executeCode).toHaveBeenCalled();
      });
    });

    it('handles responsive design workflow', async () => {
      // Mock mobile responsive behavior
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375, // Mobile width
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument();
      });

      // On mobile, input section should be in a collapsible details element
      const mobileInputSection = screen.getByText('Input for Interactive Programs');
      expect(mobileInputSection).toBeInTheDocument();

      // Keyboard shortcut hint should not be visible on mobile
      expect(screen.queryByText('Ctrl+Enter')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles API timeout gracefully', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Run Code')).toBeInTheDocument();
      });

      // Mock timeout error
      mockApiService.executeCode.mockRejectedValueOnce(
        new Error('Request timeout. Code execution took too long (>30 seconds).')
      );

      const runButton = screen.getByText('Run Code');
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/Request timeout/)).toBeInTheDocument();
      });
    });

    it('handles network disconnection during execution', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });

      // Mock network error during execution
      mockApiService.executeCode.mockRejectedValueOnce(
        new Error('Network error. Cannot connect to backend server.')
      );

      const runButton = screen.getByText('Run Code');
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      // Connection status should update to disconnected
      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });
    });

    it('handles empty code execution', async () => {
      const user = userEvent.setup();
      
      mockApiService.executeCode.mockResolvedValue({
        output: '',
        executionTime: 0.001,
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument();
      });

      // Clear all code
      const codeTextarea = screen.getByTestId('editor-textarea');
      await user.clear(codeTextarea);

      // Execute empty code
      const runButton = screen.getByText('Run Code');
      await user.click(runButton);

      await waitFor(() => {
        expect(screen.getByText('No output yet')).toBeInTheDocument();
      });
    });

    it('handles rapid language switching', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('python')).toBeInTheDocument();
      });

      const languageSelect = screen.getByDisplayValue('python');

      // Rapidly switch languages
      await user.selectOptions(languageSelect, 'javascript');
      await user.selectOptions(languageSelect, 'html');
      await user.selectOptions(languageSelect, 'python');

      // Should end up with Python selected and appropriate code
      expect(screen.getByText('PYTHON')).toBeInTheDocument();
      expect(screen.getByText(/Welcome to Python!/)).toBeInTheDocument();
    });
  });
});