import React, { useState, useEffect, useRef, useCallback } from 'react';
import analysisService, { 
  AnalysisResult, 
  GenerationResult, 
  UsageInfo, 
  LineExplanation,
  DiffLine,
  GitDiffData,
  GitDiffLine
} from '../services/analysisService';
import { getErrorMessage } from '../utils/errorUtils';
import LoadingSpinner from './LoadingSpinner';
import EnhancedCodeDiff from './EnhancedCodeDiff';
import './CodeAnalysisWindow.css';

interface CodeAnalysisWindowProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  language: string;
  onCodeUpdate: (newCode: string) => void;
}

type ExplainLevel = 'short' | 'medium' | 'long';
type ActiveTab = 'analysis' | 'generation';

const CodeAnalysisWindow: React.FC<CodeAnalysisWindowProps> = ({
  isOpen,
  onClose,
  code,
  language,
  onCodeUpdate
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analysis');
  const [explainLevel, setExplainLevel] = useState<ExplainLevel>('medium');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [showEnhancedDiff, setShowEnhancedDiff] = useState(true);
  const [gitDiffData, setGitDiffData] = useState<GitDiffData | null>(null);
  const [showGitDiff, setShowGitDiff] = useState(false);

  // Dragging and resizing state
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [size, setSize] = useState({ width: 600, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const windowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Load usage info on component mount
  useEffect(() => {
    if (isOpen) {
      loadUsageInfo();
    }
  }, [isOpen]);

  // Dragging functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === headerRef.current || headerRef.current?.contains(e.target as Node)) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragStart.y));
      setPosition({ x: newX, y: newY });
    } else if (isResizing) {
      const newWidth = Math.max(300, Math.min(window.innerWidth - position.x, resizeStart.width + (e.clientX - resizeStart.x)));
      const newHeight = Math.max(200, Math.min(window.innerHeight - position.y, resizeStart.height + (e.clientY - resizeStart.y)));
      setSize({ width: newWidth, height: newHeight });
    }
  }, [isDragging, isResizing, dragStart, position, size, resizeStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  // Add event listeners for dragging and resizing
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isDragging ? 'grabbing' : 'nw-resize';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const loadUsageInfo = async () => {
    try {
      const response = await analysisService.getUsageInfo();
      if (response.success && response.usage_info) {
        setUsageInfo(response.usage_info);
      }
    } catch (error) {
      console.error('Failed to load usage info:', error);
    }
  };

  const handleAnalyzeCode = async () => {
    if (!code.trim()) {
      setError('Please enter some code to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await analysisService.analyzeCode({
        code,
        language,
        explain_level: explainLevel
      });

      if (response.success && response.analysis) {
        setAnalysisResult(response.analysis);
        if (response.usage_info) {
          setUsageInfo(response.usage_info);
        }
        if (response.git_diff) {
          setGitDiffData(response.git_diff);
        }
      } else {
        setError(response.error || 'Analysis failed');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to analyze code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!generationPrompt.trim()) {
      setError('Please enter a prompt for code generation');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await analysisService.generateCode({
        prompt: generationPrompt,
        language,
        explain_level: explainLevel
      });

      if (response.success && response.generation) {
        setGenerationResult(response.generation);
        if (response.usage_info) {
          setUsageInfo(response.usage_info);
        }
      } else {
        setError(response.error || 'Code generation failed');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to generate code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradeToPremium = async () => {
    try {
      setError(null);
      const response = await analysisService.upgradeToPremium();
      if (response.success) {
        alert('Successfully upgraded to premium!');
        if (response.usage_info) {
          setUsageInfo(response.usage_info);
        }
        // Reload usage info to reflect premium status
        loadUsageInfo();
      } else {
        const errorMessage = response.error || 'Failed to upgrade to premium';
        setError(errorMessage);
        console.error('Upgrade failed:', errorMessage);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Network error. Please try again.';
      setError(errorMessage);
      console.error('Upgrade error:', error);
    }
  };

  const applyCorrectedCode = () => {
    if (analysisResult?.corrections.corrected_code) {
      onCodeUpdate(analysisResult.corrections.corrected_code);
    }
  };

  const applyGeneratedCode = () => {
    if (generationResult?.generated_code) {
      onCodeUpdate(generationResult.generated_code);
    }
  };

  const renderDiff = (diff: DiffLine[]) => {
    return (
      <div className="diff-container">
        {diff.map((line, index) => (
          <div 
            key={index} 
            className={`diff-line diff-${line.type}`}
          >
            <span className="diff-marker">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="diff-content">{line.content}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderGitDiff = (gitDiff: GitDiffLine[]) => {
    return (
      <div className="git-diff-container">
        <div className="git-diff-header">
          <h4>Git Changes</h4>
          <div className="git-diff-stats">
            {gitDiffData && (
              <>
                <span className="added-lines">+{gitDiffData.added_lines || 0}</span>
                <span className="removed-lines">-{gitDiffData.removed_lines || 0}</span>
              </>
            )}
          </div>
        </div>
        <div className="git-diff-content">
          {gitDiff.map((line, index) => (
            <div 
              key={index} 
              className={`git-diff-line git-diff-${line.type}`}
            >
              <span className="git-diff-line-number">{line.line_number}</span>
              <span className="git-diff-marker">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="git-diff-content">{line.content}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLineExplanations = (explanations: LineExplanation[]) => {
    return (
      <div className="line-explanations">
        {explanations.map((explanation, index) => (
          <div key={index} className="line-explanation">
            <div className="line-number">Line {explanation.line}:</div>
            <div className="line-code">
              <code>{explanation.code}</code>
            </div>
            <div className="line-desc">{explanation.explanation}</div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={windowRef}
      className={`analysis-window ${isMinimized ? 'minimized' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: isMinimized ? '50px' : `${size.height}px`,
        position: 'fixed'
      }}
    >
      <div 
        ref={headerRef}
        className="analysis-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="analysis-title">
          <span className="ai-icon">🤖</span>
          AI Code Analysis & Generation
        </div>
        <div className="analysis-controls">
          <button 
            className="minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? '□' : '_'}
          </button>
          <button 
            className="close-btn"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="analysis-content">
          {/* Usage Info */}
          {usageInfo && (
            <div className="usage-info">
              <div className="usage-stats">
                {usageInfo.is_premium ? (
                  <span className="premium-badge">Premium User</span>
                ) : (
                  <span className="free-trial">
                    {usageInfo.can_use_feature 
                      ? `${usageInfo.remaining_free} free uses remaining today`
                      : usageInfo.reset_time_hours && usageInfo.reset_time_hours > 0 
                        ? `Daily limit reached. Resets in ${usageInfo.reset_time_hours}h ${usageInfo.reset_time_minutes}m (12:00 AM IST)`
                        : `Daily limit reached. Resets in ${usageInfo.reset_time_minutes}m (12:00 AM IST)`}
                  </span>
                )}
              </div>
              {!usageInfo.is_premium && usageInfo.remaining_free === 0 && (
                <button 
                  className="upgrade-btn"
                  onClick={handleUpgradeToPremium}
                >
                  Upgrade to Premium
                </button>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button 
              className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              Code Analysis
            </button>
            <button 
              className={`tab-btn ${activeTab === 'generation' ? 'active' : ''}`}
              onClick={() => setActiveTab('generation')}
            >
              Code Generation
            </button>
          </div>

          {/* Explain Level Selector */}
          <div className="explain-level-selector">
            <label>Explanation Level:</label>
            <select 
              value={explainLevel} 
              onChange={(e) => setExplainLevel(e.target.value as ExplainLevel)}
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {getErrorMessage(error)}
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="analysis-tab">
              <div className="analysis-actions">
                <button 
                  className="analyze-btn"
                  onClick={handleAnalyzeCode}
                  disabled={isLoading || !usageInfo?.can_use_feature}
                >
                  {isLoading ? 'Analyzing...' : 'Analyze Code'}
                </button>
                
                {isLoading && (
                  <LoadingSpinner 
                    type="analysis" 
                    message="Analyzing your code with AI..." 
                    size="small"
                  />
                )}
              </div>

              {analysisResult && (
                <div className="analysis-results">
                  {/* Git Diff Section */}
                  {gitDiffData && gitDiffData.has_changes && (
                    <div className="git-diff-section">
                      <div className="section-header">
                        <h3>Git Changes Detected</h3>
                        <button 
                          className="toggle-git-diff-btn"
                          onClick={() => setShowGitDiff(!showGitDiff)}
                        >
                          {showGitDiff ? 'Hide Git Diff' : 'Show Git Diff'}
                        </button>
                      </div>
                      
                      {showGitDiff && gitDiffData.diff_lines && (
                        renderGitDiff(gitDiffData.diff_lines)
                      )}
                      
                      {!showGitDiff && (
                        <div className="git-diff-summary">
                          <p>
                            Found {gitDiffData.added_lines || 0} additions and {gitDiffData.removed_lines || 0} deletions in your git working directory.
                            Click "Show Git Diff" to see the changes.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Corrections Section */}
                  {analysisResult.corrections.has_issues && (
                    <div className="corrections-section">
                      <h3>Code Corrections</h3>
                      
                      <div className="issues-list">
                        {analysisResult.corrections.issues.map((issue, index) => (
                          <div key={index} className={`issue-item issue-${issue.type}`}>
                            <div className="issue-header">
                              <span className="issue-type">{issue.type.toUpperCase()}</span>
                              <span className="issue-line">Line {issue.line}</span>
                            </div>
                            <div className="issue-description">{issue.description}</div>
                            <div className="issue-suggestion">{issue.suggestion}</div>
                          </div>
                        ))}
                      </div>

                      <div className="corrected-code-section">
                        <div className="section-header">
                          <h4>Code Corrections</h4>
                          <div className="code-actions">
                            <button 
                              className="toggle-enhanced-diff-btn"
                              onClick={() => setShowEnhancedDiff(!showEnhancedDiff)}
                            >
                              {showEnhancedDiff ? 'Simple View' : 'Enhanced View'}
                            </button>
                            <button 
                              className="toggle-diff-btn"
                              onClick={() => setShowDiff(!showDiff)}
                              style={{ display: showEnhancedDiff ? 'none' : 'inline-block' }}
                            >
                              {showDiff ? 'Hide Diff' : 'Show Diff'}
                            </button>
                            <button 
                              className="apply-code-btn"
                              onClick={applyCorrectedCode}
                            >
                              Apply Corrections
                            </button>
                          </div>
                        </div>

                        {showEnhancedDiff ? (
                          <EnhancedCodeDiff
                            originalCode={code}
                            correctedCode={analysisResult.corrections.corrected_code}
                            diff={analysisResult.corrections.diff}
                            issues={analysisResult.corrections.issues}
                            onApplyCorrections={applyCorrectedCode}
                          />
                        ) : (
                          <>
                            {showDiff && analysisResult.corrections.diff.length > 0 ? (
                              renderDiff(analysisResult.corrections.diff)
                            ) : (
                              <pre className="corrected-code">
                                <code>{analysisResult.corrections.corrected_code}</code>
                              </pre>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Line-by-Line Explanation */}
                  <div className="explanations-section">
                    <h3>Line-by-Line Explanation</h3>
                    {renderLineExplanations(analysisResult.line_by_line_explanation)}
                  </div>

                  {/* Overall Explanation */}
                  <div className="overall-explanation-section">
                    <h3>Overall Explanation</h3>
                    <div className="explanation-content">
                      {analysisResult.overall_explanation}
                    </div>
                  </div>

                  {/* Real-World Example */}
                  <div className="example-section">
                    <h3>Real-World Example</h3>
                    <div className="example-content">
                      {analysisResult.real_world_example}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generation Tab */}
          {activeTab === 'generation' && (
            <div className="generation-tab">
              <div className="generation-input">
                <label htmlFor="generation-prompt">Describe what code you want to generate:</label>
                <textarea
                  id="generation-prompt"
                  value={generationPrompt}
                  onChange={(e) => setGenerationPrompt(e.target.value)}
                  placeholder={`e.g., "Create a function to calculate fibonacci numbers" or "Write a class for managing user authentication"`}
                  rows={3}
                />
              </div>

              <div className="generation-actions">
                <button 
                  className="generate-btn"
                  onClick={handleGenerateCode}
                  disabled={isLoading || !usageInfo?.can_use_feature}
                >
                  {isLoading ? 'Generating...' : 'Generate Code'}
                </button>
                
                {isLoading && (
                  <LoadingSpinner 
                    type="analysis" 
                    message="Generating code with AI..." 
                    size="small"
                  />
                )}
              </div>

              {generationResult && (
                <div className="generation-results">
                  {/* Generated Code */}
                  <div className="generated-code-section">
                    <div className="section-header">
                      <h3>Generated Code</h3>
                      <button 
                        className="apply-code-btn"
                        onClick={applyGeneratedCode}
                      >
                        Apply to Editor
                      </button>
                    </div>
                    <pre className="generated-code">
                      <code>{generationResult.generated_code}</code>
                    </pre>
                  </div>

                  {/* Explanation */}
                  <div className="explanation-section">
                    <h3>How It Works</h3>
                    <div className="explanation-content">
                      {generationResult.explanation}
                    </div>
                  </div>

                  {/* Line-by-Line Explanation */}
                  {generationResult.line_by_line_explanation.length > 0 && (
                    <div className="explanations-section">
                      <h3>Line-by-Line Explanation</h3>
                      {renderLineExplanations(generationResult.line_by_line_explanation)}
                    </div>
                  )}

                  {/* Usage Example */}
                  <div className="usage-example-section">
                    <h3>Usage Example</h3>
                    <div className="example-content">
                      {generationResult.usage_example}
                    </div>
                  </div>

                  {/* Best Practices */}
                  {generationResult.best_practices.length > 0 && (
                    <div className="best-practices-section">
                      <h3>Best Practices</h3>
                      <ul className="best-practices-list">
                        {generationResult.best_practices.map((practice, index) => (
                          <li key={index}>{practice}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Resize handle */}
      {!isMinimized && (
        <div 
          className="resize-handle"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      )}
    </div>
  );
};

export default CodeAnalysisWindow;