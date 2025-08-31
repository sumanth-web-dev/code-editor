import React, { useState, useEffect, useCallback } from 'react';
import { EditorState, Language } from '../types';
import ApiService from '../services/api';
import CodeEditor from '../components/CodeEditor';
import LanguageSelector from '../components/LanguageSelector';
import OutputWindow from '../components/OutputWindow';
import PreviewWindow from '../components/PreviewWindow';
import ModeToggle from '../components/ModeToggle';
import EditorErrorBoundary from '../components/EditorErrorBoundary';
import LoadingSpinner from '../components/LoadingSpinner';
import GitStatusIndicator from '../components/GitStatusIndicator';
import { useResponsive } from '../hooks/useResponsive';
import errorLogger from '../services/errorLogger';
import templateService from '../services/templateService';
import './EditorPage.css';

const EditorPage: React.FC = () => {
  const responsive = useResponsive();
  const [editorState, setEditorState] = useState<EditorState>({
    currentLanguage: 'python',
    code: '# Welcome to Python!\nprint("Hello, World!")\n\n# Try some Python code:\nname = "Developer"\nprint(f"Hello, {name}!")\n\n# Interactive example (provide input below):\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")',
    output: '',
    isExecuting: false,
    error: undefined,
    mode: 'execution',
  });
  
  const [userInput, setUserInput] = useState<string>('');

  const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check backend connection
        setConnectionStatus('checking');
        const isHealthy = await ApiService.healthCheck();
        
        if (!isHealthy) {
          setConnectionStatus('disconnected');
          setEditorState(prev => ({
            ...prev,
            error: 'Cannot connect to backend server. Please ensure the backend is running on http://localhost:5000'
          }));
          setIsLoading(false);
          return;
        }

        setConnectionStatus('connected');
        
        // Load supported languages
        const languages = await ApiService.getLanguages();
        setSupportedLanguages(languages);
        
        // Clear any previous errors
        setEditorState(prev => ({
          ...prev,
          error: undefined
        }));
        
      } catch (error: any) {
        console.error('Failed to initialize app:', error);
        errorLogger.logApiError(error, '/api/health', 'GET');
        setConnectionStatus('disconnected');
        setEditorState(prev => ({
          ...prev,
          error: error.message || 'Failed to connect to backend server'
        }));
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Helper function to detect if content is suitable for preview
  const isPreviewAvailable = (language: string, code: string): boolean => {
    const frontendLanguages = ['html', 'css', 'javascript'];
    
    if (frontendLanguages.includes(language.toLowerCase())) {
      return true;
    }
    
    // Auto-detect HTML content in other languages
    const htmlPattern = /<\s*html\s*>|<\s*!DOCTYPE\s+html\s*>|<\s*head\s*>|<\s*body\s*>/i;
    return htmlPattern.test(code);
  };

  // Helper function to extract HTML, CSS, and JavaScript from code
  const extractFrontendCode = (language: string, code: string) => {
    if (language.toLowerCase() === 'html') {
      // Extract CSS and JS from HTML
      const cssMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const jsMatch = code.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      
      return {
        html: code,
        css: cssMatch ? cssMatch[1] : '',
        javascript: jsMatch ? jsMatch[1] : ''
      };
    } else if (language.toLowerCase() === 'css') {
      return {
        html: '<div>CSS Preview</div>',
        css: code,
        javascript: ''
      };
    } else if (language.toLowerCase() === 'javascript') {
      return {
        html: '<div id="output">JavaScript Output</div>',
        css: 'body { font-family: Arial, sans-serif; padding: 20px; }',
        javascript: code
      };
    } else {
      // For other languages, try to extract HTML content
      return {
        html: code,
        css: '',
        javascript: ''
      };
    }
  };

  const getDefaultCodeForLanguage = async (language: string): Promise<string> => {
    try {
      return await templateService.getTemplateForLanguage(language, 'basic');
    } catch (error) {
      console.error('Failed to load template for language:', language, error);
      return 'console.log("Hello, World!");';
    }
  };

  const handleLanguageChange = async (language: string) => {
    const newCode = await getDefaultCodeForLanguage(language);
    const shouldUsePreview = isPreviewAvailable(language, newCode);
    
    setEditorState(prev => ({
      ...prev,
      currentLanguage: language,
      code: newCode,
      output: '',
      error: undefined,
      mode: shouldUsePreview && ['html', 'css', 'javascript'].includes(language.toLowerCase()) ? 'preview' : 'execution'
    }));
    setUserInput(''); // Clear input when switching languages
  };

  const handleModeChange = (mode: 'execution' | 'preview') => {
    setEditorState(prev => ({
      ...prev,
      mode,
      error: undefined
    }));
  };

  const handleCodeChange = (code: string) => {
    setEditorState(prev => ({
      ...prev,
      code,
      error: undefined
    }));
  };

  const handleRunCode = useCallback(async () => {
    // Check connection status before executing
    if (connectionStatus === 'disconnected') {
      setEditorState(prev => ({
        ...prev,
        error: 'Cannot execute code: Backend server is not connected'
      }));
      return;
    }

    setEditorState(prev => ({
      ...prev,
      isExecuting: true,
      output: '',
      error: undefined
    }));

    try {
      const result = await ApiService.executeCode({
        language: editorState.currentLanguage,
        code: editorState.code,
        input: userInput.trim() || undefined
      });

      setEditorState(prev => ({
        ...prev,
        output: result.output,
        isExecuting: false
      }));
    } catch (error: any) {
      console.error('Code execution failed:', error);
      errorLogger.logApiError(error, '/api/execute', 'POST');
      
      // Check if it's a network error and update connection status
      if (error.message.includes('Network error') || error.message.includes('ECONNREFUSED')) {
        setConnectionStatus('disconnected');
      }
      
      setEditorState(prev => ({
        ...prev,
        error: error.message || 'Code execution failed',
        isExecuting: false
      }));
    }
  }, [connectionStatus, editorState.currentLanguage, editorState.code, userInput]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (connectionStatus === 'connected' && !editorState.isExecuting) {
          handleRunCode();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleRunCode, connectionStatus, editorState.isExecuting]);

  const handleRetryConnection = async () => {
    setConnectionStatus('checking');
    setEditorState(prev => ({
      ...prev,
      error: undefined
    }));

    try {
      const isHealthy = await ApiService.healthCheck();
      if (isHealthy) {
        setConnectionStatus('connected');
        const languages = await ApiService.getLanguages();
        setSupportedLanguages(languages);
      } else {
        setConnectionStatus('disconnected');
        setEditorState(prev => ({
          ...prev,
          error: 'Backend server is not responding'
        }));
      }
    } catch (error: any) {
      errorLogger.logApiError(error, '/api/health', 'GET');
      setConnectionStatus('disconnected');
      setEditorState(prev => ({
        ...prev,
        error: error.message || 'Failed to connect to backend'
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="editor-page">
        <div className="loading">
          <LoadingSpinner 
            type="connection" 
            message="Initializing code editor..." 
            size="large"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`editor-page ${responsive.isMobile ? 'mobile' : ''} ${responsive.isTablet ? 'tablet' : ''} ${responsive.isTouchDevice ? 'touch-device' : ''}`}>
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <LanguageSelector
            selectedLanguage={editorState.currentLanguage}
            onLanguageChange={handleLanguageChange}
            supportedLanguages={supportedLanguages}
          />
          <ModeToggle
            currentMode={editorState.mode}
            onModeChange={handleModeChange}
            isPreviewAvailable={isPreviewAvailable(editorState.currentLanguage, editorState.code)}
            language={editorState.currentLanguage}
          />
          <div className={`connection-status ${connectionStatus}`}>
            <div className="status-indicator"></div>
            <span className="status-text">
              {connectionStatus === 'connected' && 'Connected'}
              {connectionStatus === 'disconnected' && 'Disconnected'}
              {connectionStatus === 'checking' && 'Connecting...'}
            </span>
            {connectionStatus === 'disconnected' && (
              <button className="retry-button" onClick={handleRetryConnection}>
                Retry
              </button>
            )}
          </div>
          <GitStatusIndicator />
        </div>
        {editorState.mode === 'execution' && (
          <button
            className="run-button"
            onClick={handleRunCode}
            disabled={editorState.isExecuting || connectionStatus !== 'connected'}
            title="Run code (Ctrl+Enter)"
          >
            {editorState.isExecuting ? 'Running...' : 'Run Code'}
            {!responsive.isMobile && <span className="keyboard-shortcut">Ctrl+Enter</span>}
          </button>
        )}
      </div>

      <div className={`editor-content ${responsive.orientation}`}>
        <div className="code-section">
          <EditorErrorBoundary
            onError={(error, errorInfo) => {
              errorLogger.logReactError(error, errorInfo, 'code_editor');
            }}
          >
            <CodeEditor
              language={editorState.currentLanguage}
              code={editorState.code}
              onChange={handleCodeChange}
              onRun={handleRunCode}
            />
          </EditorErrorBoundary>
        </div>

        <div className="right-panel">
          {editorState.mode === 'execution' ? (
            <div className="input-output-section">
              {!responsive.isMobile && (
                <div className="input-section">
                  <div className="input-header">
                    <h3>Input</h3>
                    <span className="input-hint">Provide input for interactive programs (one value per line)</span>
                  </div>
                  <textarea
                    className="input-textarea"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Enter input values here (e.g., for input() in Python)..."
                    rows={responsive.isTablet ? 2 : 3}
                  />
                </div>
              )}
              
              <div className="output-section">
                <OutputWindow
                  output={editorState.output}
                  isLoading={editorState.isExecuting}
                  error={editorState.error}
                />
              </div>
              
              {responsive.isMobile && (
                <div className="mobile-input-section">
                  <details>
                    <summary>Input for Interactive Programs</summary>
                    <textarea
                      className="input-textarea"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Enter input values here..."
                      rows={2}
                    />
                  </details>
                </div>
              )}
            </div>
          ) : (
            <div className="preview-section">
              <PreviewWindow
                {...extractFrontendCode(editorState.currentLanguage, editorState.code)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPage;