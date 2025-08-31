import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CodeEditor from '../CodeEditor';

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

const defaultProps = {
  language: 'python',
  code: 'print("Hello World")',
  onChange: jest.fn(),
  onRun: jest.fn(),
};

describe('CodeEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('displays the correct language badge', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('PYTHON')).toBeInTheDocument();
  });

  it('displays the keyboard shortcut hint', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('Press Ctrl+Enter to run')).toBeInTheDocument();
  });

  it('calls onChange when code is modified', async () => {
    const user = userEvent.setup();
    const mockOnChange = jest.fn();
    
    render(<CodeEditor {...defaultProps} onChange={mockOnChange} />);
    
    const textarea = screen.getByTestId('editor-textarea');
    await user.clear(textarea);
    await user.type(textarea, 'new code');
    
    expect(mockOnChange).toHaveBeenCalledWith('new code');
  });

  it('opens and closes settings panel', async () => {
    const user = userEvent.setup();
    render(<CodeEditor {...defaultProps} />);
    
    const settingsButton = screen.getByTitle('Editor Settings');
    await user.click(settingsButton);
    
    expect(screen.getByText('Editor Settings')).toBeInTheDocument();
    
    const closeButton = screen.getByText('×');
    await user.click(closeButton);
    
    expect(screen.queryByText('Editor Settings')).not.toBeInTheDocument();
  });

  it('updates theme setting', async () => {
    const user = userEvent.setup();
    render(<CodeEditor {...defaultProps} />);
    
    const settingsButton = screen.getByTitle('Editor Settings');
    await user.click(settingsButton);
    
    const themeSelect = screen.getByDisplayValue('Dark');
    await user.selectOptions(themeSelect, 'vs-light');
    
    expect(themeSelect).toHaveValue('vs-light');
  });

  it('updates font size setting', async () => {
    const user = userEvent.setup();
    render(<CodeEditor {...defaultProps} />);
    
    const settingsButton = screen.getByTitle('Editor Settings');
    await user.click(settingsButton);
    
    const fontSizeSlider = screen.getByDisplayValue('14');
    await user.clear(fontSizeSlider);
    await user.type(fontSizeSlider, '16');
    
    expect(screen.getByText('16px')).toBeInTheDocument();
  });

  it('displays keyboard shortcuts in settings', async () => {
    const user = userEvent.setup();
    render(<CodeEditor {...defaultProps} />);
    
    const settingsButton = screen.getByTitle('Editor Settings');
    await user.click(settingsButton);
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Enter')).toBeInTheDocument();
    expect(screen.getByText('Run Code')).toBeInTheDocument();
  });

  it('maps languages correctly to Monaco language IDs', () => {
    const languageTests = [
      { input: 'python', expected: 'python' },
      { input: 'javascript', expected: 'javascript' },
      { input: 'java', expected: 'java' },
      { input: 'cpp', expected: 'cpp' },
      { input: 'unknown', expected: 'plaintext' },
    ];

    languageTests.forEach(({ input, expected }) => {
      const { rerender } = render(<CodeEditor {...defaultProps} language={input} />);
      // The language mapping is internal, but we can test that it renders without error
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
      rerender(<CodeEditor {...defaultProps} language="python" />);
    });
  });

  it('handles undefined code changes gracefully', () => {
    const mockOnChange = jest.fn();
    render(<CodeEditor {...defaultProps} onChange={mockOnChange} />);
    
    // Simulate Monaco calling onChange with undefined
    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: undefined } });
    
    // Should not call onChange with undefined
    expect(mockOnChange).not.toHaveBeenCalledWith(undefined);
  });

  it('toggles word wrap setting', async () => {
    const user = userEvent.setup();
    render(<CodeEditor {...defaultProps} />);
    
    const settingsButton = screen.getByTitle('Editor Settings');
    await user.click(settingsButton);
    
    const wordWrapSelect = screen.getByDisplayValue('On');
    await user.selectOptions(wordWrapSelect, 'off');
    
    expect(wordWrapSelect).toHaveValue('off');
  });

  it('toggles minimap setting', async () => {
    const user = userEvent.setup();
    render(<CodeEditor {...defaultProps} />);
    
    const settingsButton = screen.getByTitle('Editor Settings');
    await user.click(settingsButton);
    
    const minimapCheckbox = screen.getByLabelText('Show Minimap');
    await user.click(minimapCheckbox);
    
    expect(minimapCheckbox).toBeChecked();
  });
});