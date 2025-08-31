import React, { useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';
import { CodeEditorProps } from '../types';
import AnalysisButton from './AnalysisButton';
import CodeAnalysisWindow from './CodeAnalysisWindow';
import LoadingSpinner from './LoadingSpinner';
import './CodeEditor.css';

// Configure Monaco Editor for production
if (process.env.NODE_ENV === 'production') {
  // Use faster CDN for Monaco Editor in production
  loader.config({
    paths: {
      vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
    }
  });
} else {
  // Development configuration
  loader.config({
    'vs/nls': {
      availableLanguages: {
        '*': 'en'
      }
    }
  });
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  code,
  onChange,
  onRun
}) => {
  const editorRef = useRef<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [useSimpleEditor, setUseSimpleEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnalysisWindow, setShowAnalysisWindow] = useState(false);
  const [editorSettings, setEditorSettings] = useState({
    fontSize: 14,
    lineHeight: 20,
    wordWrap: 'on' as 'on' | 'off',
    minimap: false,
    lineNumbers: 'on' as 'on' | 'off' | 'relative',
    theme: 'vs-dark' as 'vs-dark' | 'vs-light' | 'hc-black',
    tabSize: 2,
    insertSpaces: true,
    renderWhitespace: 'selection' as 'none' | 'boundary' | 'selection' | 'trailing' | 'all',
    cursorBlinking: 'blink' as 'blink' | 'smooth' | 'phase' | 'expand' | 'solid',
    autoClosingBrackets: 'always' as 'always' | 'languageDefined' | 'beforeWhitespace' | 'never',
    autoClosingQuotes: 'always' as 'always' | 'languageDefined' | 'beforeWhitespace' | 'never',
    formatOnPaste: true,
    formatOnType: true
  });

  // Language mapping for Monaco Editor
  const getMonacoLanguage = (lang: string): string => {
    const languageMap: { [key: string]: string } = {
      'python': 'python',
      'javascript': 'javascript',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'csharp',
      'php': 'php',
      'ruby': 'ruby',
      'go': 'go',
      'rust': 'rust',
      'r': 'r',
      'typescript': 'typescript',
      'html': 'html',
      'css': 'css'
    };
    return languageMap[lang] || 'plaintext';
  };

  // Add timeout to detect Monaco Editor loading issues
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Monaco Editor failed to load, switching to simple editor');
        setUseSimpleEditor(true);
        setIsLoading(false);
      }
    }, 8000); // 8 second timeout - reduced for faster fallback

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Set editor theme based on settings
  const getEditorTheme = useCallback((): string => {
    return editorSettings.theme;
  }, [editorSettings.theme]);

  // Update Monaco language when language prop changes
  React.useEffect(() => {
    if (editorRef.current && !useSimpleEditor) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        const monacoLanguage = getMonacoLanguage(language);
        console.log('Updating Monaco language to:', monacoLanguage);
        
        // Get monaco instance from the editor
        const monaco = (window as any).monaco;
        if (monaco) {
          try {
            monaco.editor.setModelLanguage(model, monacoLanguage);
            
            // Force syntax highlighting refresh after language change
            setTimeout(() => {
              editor.trigger('editor', 'editor.action.reindentlines', {});
              // Force theme reapplication
              monaco.editor.setTheme(getEditorTheme());
            }, 100);
          } catch (error) {
            console.warn('Failed to update language:', error);
          }
        }
      }
    }
  }, [language, useSimpleEditor, getEditorTheme]);

  // Handle simple editor change
  const handleSimpleEditorChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  // Handle simple editor key press
  const handleSimpleEditorKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      onRun();
    }
  };

  // Handle editor mount
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    setIsLoading(false);

    // Force Monaco to register all languages and themes
    monaco.languages.getLanguages().forEach((lang: any) => {
      console.log('Available language:', lang.id);
    });

    // Ensure proper language model is set with explicit language registration
    const model = editor.getModel();
    if (model) {
      const monacoLanguage = getMonacoLanguage(language);
      console.log('Setting Monaco language to:', monacoLanguage);
      
      // Force language registration if not already registered
      try {
        monaco.editor.setModelLanguage(model, monacoLanguage);
      } catch (error) {
        console.warn('Failed to set language, falling back to plaintext:', error);
        monaco.editor.setModelLanguage(model, 'plaintext');
      }
      
      // Force syntax highlighting refresh
      setTimeout(() => {
        editor.trigger('editor', 'editor.action.reindentlines', {});
      }, 100);
    }

    // Configure editor options with enhanced syntax highlighting
    editor.updateOptions({
      fontSize: editorSettings.fontSize,
      lineHeight: editorSettings.lineHeight,
      minimap: { enabled: editorSettings.minimap },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: editorSettings.wordWrap,
      lineNumbers: editorSettings.lineNumbers,
      renderLineHighlight: 'line',
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      cursorStyle: 'line',
      tabSize: editorSettings.tabSize,
      insertSpaces: editorSettings.insertSpaces,
      renderWhitespace: editorSettings.renderWhitespace,
      cursorBlinking: editorSettings.cursorBlinking,
      autoClosingBrackets: editorSettings.autoClosingBrackets,
      autoClosingQuotes: editorSettings.autoClosingQuotes,
      formatOnPaste: editorSettings.formatOnPaste,
      formatOnType: editorSettings.formatOnType,
      // Enhanced syntax highlighting options
      semanticHighlighting: { enabled: true },
      colorDecorators: true,
      bracketPairColorization: { enabled: true },
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun();
    });

    // Save shortcut (Ctrl+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Trigger save action - for now just prevent default browser save
      // In a real app, this could save to localStorage or trigger a save callback
      console.log('Save triggered');
    });

    // Undo shortcut (Ctrl+Z) - already built into Monaco
    // Redo shortcut (Ctrl+Y or Ctrl+Shift+Z) - already built into Monaco

    // Select All shortcut (Ctrl+A) - already built into Monaco

    // Find shortcut (Ctrl+F) - already built into Monaco
    // Replace shortcut (Ctrl+H) - already built into Monaco

    // Comment/Uncomment shortcut (Ctrl+/)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      editor.trigger('keyboard', 'editor.action.commentLine', {});
    });

    // Duplicate line shortcut (Ctrl+D)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.trigger('keyboard', 'editor.action.copyLinesDownAction', {});
    });

    // Move line up (Alt+Up)
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      editor.trigger('keyboard', 'editor.action.moveLinesUpAction', {});
    });

    // Move line down (Alt+Down)
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      editor.trigger('keyboard', 'editor.action.moveLinesDownAction', {});
    });

    // Format document (Shift+Alt+F)
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      editor.trigger('keyboard', 'editor.action.formatDocument', {});
    });

    // Go to line (Ctrl+G)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      editor.trigger('keyboard', 'editor.action.gotoLine', {});
    });

    // Toggle word wrap (Alt+Z)
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
      const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
      const newWrap = currentWrap === 'on' ? 'off' : 'on';
      editor.updateOptions({ wordWrap: newWrap });
      setEditorSettings(prev => ({ ...prev, wordWrap: newWrap }));
    });

    // Focus the editor
    editor.focus();
  };

  // Handle editor value change
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  // Update editor settings
  const updateEditorSettings = useCallback((newSettings: Partial<typeof editorSettings>) => {
    setEditorSettings(prev => {
      const updated = { ...prev, ...newSettings };

      // Update editor options if editor is mounted
      if (editorRef.current) {
        editorRef.current.updateOptions({
          fontSize: updated.fontSize,
          lineHeight: updated.lineHeight,
          minimap: { enabled: updated.minimap },
          wordWrap: updated.wordWrap,
          lineNumbers: updated.lineNumbers,
          tabSize: updated.tabSize,
          insertSpaces: updated.insertSpaces,
          renderWhitespace: updated.renderWhitespace,
          cursorBlinking: updated.cursorBlinking,
          autoClosingBrackets: updated.autoClosingBrackets,
          autoClosingQuotes: updated.autoClosingQuotes,
          formatOnPaste: updated.formatOnPaste,
          formatOnType: updated.formatOnType,
        });
      }

      return updated;
    });
  }, []);

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <div className="code-editor-container">
      <div className="code-editor-header">
        <div className="editor-info">
          <span className="language-badge">{language.toUpperCase()}</span>
          <span className="editor-hint">Press Ctrl+Enter to run</span>
        </div>
        <div className="editor-controls">
          <AnalysisButton
            onClick={() => setShowAnalysisWindow(true)}
            disabled={!code.trim()}
          />
          <button
            className="settings-button"
            onClick={toggleSettings}
            title="Editor Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="editor-settings-panel">
          <div className="settings-header">
            <h3>Editor Settings</h3>
            <button className="close-settings" onClick={() => setShowSettings(false)}>×</button>
          </div>

          <div className="settings-grid">
            <div className="setting-group">
              <label>Theme</label>
              <select
                value={editorSettings.theme}
                onChange={(e) => updateEditorSettings({ theme: e.target.value as any })}
              >
                <option value="vs-dark">Dark</option>
                <option value="vs-light">Light</option>
                <option value="hc-black">High Contrast</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Font Size</label>
              <input
                type="range"
                min="10"
                max="24"
                value={editorSettings.fontSize}
                onChange={(e) => updateEditorSettings({ fontSize: parseInt(e.target.value) })}
              />
              <span>{editorSettings.fontSize}px</span>
            </div>

            <div className="setting-group">
              <label>Tab Size</label>
              <input
                type="range"
                min="2"
                max="8"
                value={editorSettings.tabSize}
                onChange={(e) => updateEditorSettings({ tabSize: parseInt(e.target.value) })}
              />
              <span>{editorSettings.tabSize}</span>
            </div>

            <div className="setting-group">
              <label>Line Numbers</label>
              <select
                value={editorSettings.lineNumbers}
                onChange={(e) => updateEditorSettings({ lineNumbers: e.target.value as any })}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
                <option value="relative">Relative</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Word Wrap</label>
              <select
                value={editorSettings.wordWrap}
                onChange={(e) => updateEditorSettings({ wordWrap: e.target.value as any })}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Show Minimap</label>
              <input
                type="checkbox"
                checked={editorSettings.minimap}
                onChange={(e) => updateEditorSettings({ minimap: e.target.checked })}
              />
            </div>

            <div className="setting-group">
              <label>Render Whitespace</label>
              <select
                value={editorSettings.renderWhitespace}
                onChange={(e) => updateEditorSettings({ renderWhitespace: e.target.value as any })}
              >
                <option value="none">None</option>
                <option value="boundary">Boundary</option>
                <option value="selection">Selection</option>
                <option value="trailing">Trailing</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Auto Closing Brackets</label>
              <select
                value={editorSettings.autoClosingBrackets}
                onChange={(e) => updateEditorSettings({ autoClosingBrackets: e.target.value as any })}
              >
                <option value="always">Always</option>
                <option value="languageDefined">Language Defined</option>
                <option value="beforeWhitespace">Before Whitespace</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Format on Paste</label>
              <input
                type="checkbox"
                checked={editorSettings.formatOnPaste}
                onChange={(e) => updateEditorSettings({ formatOnPaste: e.target.checked })}
              />
            </div>

            <div className="setting-group">
              <label>Format on Type</label>
              <input
                type="checkbox"
                checked={editorSettings.formatOnType}
                onChange={(e) => updateEditorSettings({ formatOnType: e.target.checked })}
              />
            </div>
          </div>

          <div className="keyboard-shortcuts">
            <h4>Keyboard Shortcuts</h4>
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+Enter</span>
                <span className="shortcut-desc">Run Code</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+S</span>
                <span className="shortcut-desc">Save</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+Z</span>
                <span className="shortcut-desc">Undo</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+Y</span>
                <span className="shortcut-desc">Redo</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+F</span>
                <span className="shortcut-desc">Find</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+H</span>
                <span className="shortcut-desc">Replace</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+/</span>
                <span className="shortcut-desc">Toggle Comment</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+D</span>
                <span className="shortcut-desc">Duplicate Line</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Alt+↑/↓</span>
                <span className="shortcut-desc">Move Line</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Shift+Alt+F</span>
                <span className="shortcut-desc">Format Document</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+G</span>
                <span className="shortcut-desc">Go to Line</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Alt+Z</span>
                <span className="shortcut-desc">Toggle Word Wrap</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="code-editor-wrapper">
        {useSimpleEditor ? (
          <textarea
            className="simple-code-editor"
            value={code}
            onChange={handleSimpleEditorChange}
            onKeyDown={handleSimpleEditorKeyPress}
            placeholder={`Write your ${language} code here... (Press Ctrl+Enter to run)`}
            style={{
              width: '100%',
              height: '100%',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace',
              fontSize: `${editorSettings.fontSize}px`,
              lineHeight: `${editorSettings.lineHeight}px`,
              padding: '10px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              backgroundColor: editorSettings.theme === 'vs-dark' ? '#1e1e1e' : '#ffffff',
              color: editorSettings.theme === 'vs-dark' ? '#d4d4d4' : '#000000',
              tabSize: editorSettings.tabSize,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={getMonacoLanguage(language)}
            value={code}
            theme={getEditorTheme()}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              selectOnLineNumbers: true,
              roundedSelection: false,
              readOnly: false,
              cursorStyle: 'line',
              automaticLayout: true,
              fontSize: editorSettings.fontSize,
              lineHeight: editorSettings.lineHeight,
              minimap: { enabled: editorSettings.minimap },
              scrollBeyondLastLine: false,
              wordWrap: editorSettings.wordWrap,
              lineNumbers: editorSettings.lineNumbers,
              renderLineHighlight: 'line',
              contextmenu: true,
              mouseWheelZoom: true,
              smoothScrolling: true,
              cursorBlinking: editorSettings.cursorBlinking,
              cursorSmoothCaretAnimation: 'on',
              renderWhitespace: editorSettings.renderWhitespace,
              renderControlCharacters: false,
              fontLigatures: true,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace',
              tabSize: editorSettings.tabSize,
              insertSpaces: editorSettings.insertSpaces,
              autoClosingBrackets: editorSettings.autoClosingBrackets,
              autoClosingQuotes: editorSettings.autoClosingQuotes,
              formatOnPaste: editorSettings.formatOnPaste,
              formatOnType: editorSettings.formatOnType,
              // Enhanced syntax highlighting and suggestions
              quickSuggestions: {
                other: true,
                comments: true,
                strings: true
              },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              tabCompletion: 'on'
            }}
            loading={
              <LoadingSpinner
                type="loading"
                message="Loading Monaco editor..."
                size="medium"
              />
            }
          />
        )}
      </div>

      {/* Code Analysis Window */}
      <CodeAnalysisWindow
        isOpen={showAnalysisWindow}
        onClose={() => setShowAnalysisWindow(false)}
        code={code}
        language={language}
        onCodeUpdate={onChange}
      />
    </div>
  );
};

export default CodeEditor;