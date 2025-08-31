import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EditorPage from '../EditorPage';
import ApiService from '../../services/api';
import { Language } from '../../types';

// Mock all the components
jest.mock('../../../src/components/CodeEditor', () => {
  return {
    __esModule: true,
    default: ({ language, code, onChange, onRun }: any) => (
      <div data-testid="code-editor">
        <div>Language: {language}</div>
        <textarea
          data-testid="code-textarea"
          value={code}
          onChange={(e) => onChange(e.target.value)}
        />
        <button onClick={onRun}>Run Code</button>
      </div>
    ),
  };
});

jest.mock('../../../src/components/LanguageSelector', () => {
  return {
    __esModule: true,
    default: ({ selectedLanguage, onLanguageChange, supportedLanguages }: any) => (
      <div data-testid="language-selector">
        <select
          value={selectedLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          data-testid="language-select"
        >
          {supportedLanguages.map((lang: Language) => (
            <option key={lang.id} value={lang.id}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
    ),
  };
});

jest.mock('../../../src/components/OutputWindow', () => {
  return {
    __esModule: true,
    default: ({ output, isLoading, error }: any) => (
      <div data-testid="output-window">
        {isLoading && <div>Loading...</div>}
        {error && <div data-testid="error-message">{error}</div>}
        {output && <div data-testid="output-content">{output}</div>}
      </div>
    ),
  };
});

jest.mock('../../../src/components/PreviewWindow', () => {
  return {
    __esModule: true,
    default: ({ html, css, javascript }: any) => (
      <div data-testid="preview-window">
        <div>HTML: {html}</div>
        <div>CSS: {css}</div>
        <div>JS: {javascript}</div>
      </div>
    ),
  };
});

jest.mock('../../../src/components/ModeToggle', () => {
  return {
    __esModule: true,
    default: ({ currentMode, onModeChange, isPreviewAvailable }: any) => (
      <div data-testid="mode-toggle">
        <button
          onClick={() => onModeChange('execution')}
          className={currentMode === 'execution' ? 'active' : ''}
        >
          Execute
        </button>
        <button
          onClick={() => onModeChange('preview')}
          disabled={!isPreviewAvailable}
          className={currentMode === 'preview' ? 'active' : ''}
        >
          Preview
        </button>
      </div>
    ),
  };
});

jest.mock('../../../src/components/EditorErrorBoundary', () => {
  return {
    EditorErrorBoundary: ({ children }: any) => <div>{children}</div>,
  };
});

jest.mock('../../../src/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isTouchDevice: false,
    orientation: 'landscape',
  }),
}));

// Mock ApiService
jest.mock('../../services/api');
const mockApiService = ApiService as jest.Mocked<typeof ApiService>;

// Mock errorLogger
jest.mock('../../services/errorLogger', () => ({
  __esModule: true,
  default: {
    logApiError: jest.fn(),
    logReactError: jest.fn(),
  },
}));

const mockLanguages: Language[] = [
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

describe('EditorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiService.healthCheck.mockResolvedValue(true);
    mockApiService.getLanguages.mockResolvedValue(mockLanguages);
  });

  it('renders loading state initially', () => {
    render(<EditorPage />);
    expect(screen.getByText('Loading editor...')).toBeInTheDocument();
  });

  it('initializes successfully with backend connection', async () => {
    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    expect(mockApiService.healthCheck).toHaveBeenCalled();
    expect(mockApiService.getLanguages).toHaveBeenCalled();
  });

  it('handles backend connection failure', async () => {
    mockApiService.healthCheck.mockResolvedValue(false);

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Cannot connect to backend server/)).toBeInTheDocument();
    });
  });

  it('displays connection status', async () => {
    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('allows language selection', async () => {
    const user = userEvent.setup();
    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('language-select')).toBeInTheDocument();
    });

    const languageSelect = screen.getByTestId('language-select');
    await user.selectOptions(languageSelect, 'javascript');

    expect(screen.getByText('Language: javascript')).toBeInTheDocument();
  });

  it('executes code successfully', async () => {
    const user = userEvent.setup();
    mockApiService.executeCode.mockResolvedValue({
      output: 'Hello World\n',
      executionTime: 0.123,
    });

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByText('Run Code')).toBeInTheDocument();
    });

    const runButton = screen.getByText('Run Code');
    await user.click(runButton);

    await waitFor(() => {
      expect(screen.getByTestId('output-content')).toHaveTextContent('Hello World');
    });

    expect(mockApiService.executeCode).toHaveBeenCalledWith({
      language: 'python',
      code: expect.stringContaining('print("Hello, World!")'),
      input: undefined,
    });
  });

  it('handles code execution errors', async () => {
    const user = userEvent.setup();
    mockApiService.executeCode.mockRejectedValue(new Error('SyntaxError: invalid syntax'));

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByText('Run Code')).toBeInTheDocument();
    });

    const runButton = screen.getByText('Run Code');
    await user.click(runButton);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('SyntaxError: invalid syntax');
    });
  });

  it('switches between execution and preview modes', async () => {
    const user = userEvent.setup();
    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('mode-toggle')).toBeInTheDocument();
    });

    // Switch to HTML to enable preview
    const languageSelect = screen.getByTestId('language-select');
    await user.selectOptions(languageSelect, 'html');

    // Switch to preview mode
    const previewButton = screen.getByText('Preview');
    await user.click(previewButton);

    expect(screen.getByTestId('preview-window')).toBeInTheDocument();
    expect(screen.queryByTestId('output-window')).not.toBeInTheDocument();
  });

  it('handles user input for interactive programs', async () => {
    const user = userEvent.setup();
    mockApiService.executeCode.mockResolvedValue({
      output: 'Hello John\n',
      executionTime: 0.123,
    });

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter input values here/)).toBeInTheDocument();
    });

    const inputTextarea = screen.getByPlaceholderText(/Enter input values here/);
    await user.type(inputTextarea, 'John');

    const runButton = screen.getByText('Run Code');
    await user.click(runButton);

    await waitFor(() => {
      expect(mockApiService.executeCode).toHaveBeenCalledWith({
        language: 'python',
        code: expect.any(String),
        input: 'John',
      });
    });
  });

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup();
    mockApiService.executeCode.mockResolvedValue({
      output: 'Hello World\n',
      executionTime: 0.123,
    });

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    // Simulate Ctrl+Enter
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mockApiService.executeCode).toHaveBeenCalled();
    });
  });

  it('retries connection when retry button is clicked', async () => {
    const user = userEvent.setup();
    mockApiService.healthCheck.mockResolvedValueOnce(false);

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Mock successful retry
    mockApiService.healthCheck.mockResolvedValueOnce(true);

    const retryButton = screen.getByText('Retry');
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('updates code when typing in editor', async () => {
    const user = userEvent.setup();
    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('code-textarea')).toBeInTheDocument();
    });

    const codeTextarea = screen.getByTestId('code-textarea');
    await user.clear(codeTextarea);
    await user.type(codeTextarea, 'print("New code")');

    expect(codeTextarea).toHaveValue('print("New code")');
  });

  it('shows loading state during code execution', async () => {
    const user = userEvent.setup();
    let resolveExecution: (value: any) => void;
    const executionPromise = new Promise((resolve) => {
      resolveExecution = resolve;
    });
    mockApiService.executeCode.mockReturnValue(executionPromise);

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByText('Run Code')).toBeInTheDocument();
    });

    const runButton = screen.getByText('Run Code');
    await user.click(runButton);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Resolve the execution
    resolveExecution!({
      output: 'Done',
      executionTime: 0.1,
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('prevents execution when disconnected', async () => {
    const user = userEvent.setup();
    mockApiService.healthCheck.mockResolvedValue(false);

    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    // Try to run code while disconnected
    const runButton = screen.getByText('Run Code');
    expect(runButton).toBeDisabled();
  });

  it('handles responsive design classes', async () => {
    // Mock mobile responsive hook
    jest.doMock('../../../src/hooks/useResponsive', () => ({
      useResponsive: () => ({
        isMobile: true,
        isTablet: false,
        isTouchDevice: true,
        orientation: 'portrait',
      }),
    }));

    const { container } = render(<EditorPage />);

    await waitFor(() => {
      expect(container.firstChild).toHaveClass('mobile');
    });
  });

  it('extracts frontend code correctly for preview', async () => {
    const user = userEvent.setup();
    render(<EditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('language-select')).toBeInTheDocument();
    });

    // Switch to HTML
    const languageSelect = screen.getByTestId('language-select');
    await user.selectOptions(languageSelect, 'html');

    // Switch to preview mode
    const previewButton = screen.getByText('Preview');
    await user.click(previewButton);

    const previewWindow = screen.getByTestId('preview-window');
    expect(previewWindow).toBeInTheDocument();
  });
});