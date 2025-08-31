import React, { useState } from 'react';
import { DiffLine, CodeIssue } from '../services/analysisService';
import './EnhancedCodeDiff.css';

interface EnhancedCodeDiffProps {
  originalCode: string;
  correctedCode: string;
  diff: DiffLine[];
  issues: CodeIssue[];
  onApplyCorrections: () => void;
}

interface CodeLine {
  lineNumber: number;
  content: string;
  type: 'original' | 'corrected' | 'unchanged';
  hasIssue?: boolean;
  issueType?: string;
  issueDescription?: string;
}

const EnhancedCodeDiff: React.FC<EnhancedCodeDiffProps> = ({
  originalCode,
  correctedCode,
  diff,
  issues,
  onApplyCorrections
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified' | 'original' | 'corrected'>('side-by-side');

  // Parse the original and corrected code into lines with metadata
  const parseCodeLines = (): { original: CodeLine[], corrected: CodeLine[] } => {
    const originalLines = originalCode.split('\n');
    const correctedLines = correctedCode.split('\n');
    
    // Create issue map for quick lookup
    const issueMap = new Map<number, CodeIssue>();
    issues.forEach(issue => {
      issueMap.set(issue.line, issue);
    });

    // Identify changed lines from diff
    const removedLines = new Set<number>();
    
    diff.forEach(diffLine => {
      if (diffLine.type === 'removed') {
        // Find line numbers that were removed (have issues)
        issues.forEach(issue => {
          if (diffLine.content.includes(issue.description) || 
              originalLines[issue.line - 1]?.includes(diffLine.content.trim())) {
            removedLines.add(issue.line);
          }
        });
      }
    });

    // If we have issues, mark those lines as changed
    issues.forEach(issue => {
      removedLines.add(issue.line);
    });

    const original: CodeLine[] = originalLines.map((content, index) => {
      const lineNumber = index + 1;
      const issue = issueMap.get(lineNumber);
      const hasChanges = removedLines.has(lineNumber) || !!issue;
      
      return {
        lineNumber,
        content,
        type: hasChanges ? 'original' : 'unchanged',
        hasIssue: !!issue,
        issueType: issue?.type,
        issueDescription: issue?.description
      };
    });

    const corrected: CodeLine[] = correctedLines.map((content, index) => {
      const lineNumber = index + 1;
      // Check if this line corresponds to a corrected issue
      const hasCorrection = issues.some(issue => {
        const originalLine = originalLines[issue.line - 1];
        return originalLine && originalLine !== content && Math.abs(issue.line - lineNumber) <= 2;
      });
      
      return {
        lineNumber,
        content,
        type: hasCorrection ? 'corrected' : 'unchanged'
      };
    });

    return { original, corrected };
  };

  const { original: originalLines, corrected: correctedLines } = parseCodeLines();

  const renderLineNumber = (lineNumber: number) => (
    <span className="line-number">{lineNumber}</span>
  );

  const renderCodeLine = (line: CodeLine, side: 'original' | 'corrected') => {
    const className = `code-line ${line.type} ${line.hasIssue ? 'has-issue' : ''}`;
    
    return (
      <div key={`${side}-${line.lineNumber}`} className={className}>
        {renderLineNumber(line.lineNumber)}
        <div className="line-content">
          <code>{line.content}</code>
          {line.hasIssue && (
            <div className="issue-indicator" title={line.issueDescription}>
              <span className={`issue-badge issue-${line.issueType}`}>
                {line.issueType?.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUnifiedDiff = () => {
    const unifiedLines: (CodeLine & { side: 'original' | 'corrected' })[] = [];
    
    // Combine original and corrected lines for unified view
    const maxLines = Math.max(originalLines.length, correctedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const correctedLine = correctedLines[i];
      
      if (originalLine && originalLine.type === 'original') {
        unifiedLines.push({ ...originalLine, side: 'original' });
      }
      if (correctedLine && correctedLine.type === 'corrected') {
        unifiedLines.push({ ...correctedLine, side: 'corrected' });
      }
      if (originalLine && originalLine.type === 'unchanged') {
        unifiedLines.push({ ...originalLine, side: 'original' });
      }
    }

    return (
      <div className="unified-diff">
        {unifiedLines.map((line, index) => (
          <div key={index} className={`unified-line ${line.type} ${line.side}`}>
            <span className="diff-marker">
              {line.type === 'original' ? '-' : line.type === 'corrected' ? '+' : ' '}
            </span>
            {renderLineNumber(line.lineNumber)}
            <div className="line-content">
              <code>{line.content}</code>
              {line.hasIssue && (
                <div className="issue-indicator" title={line.issueDescription}>
                  <span className={`issue-badge issue-${line.issueType}`}>
                    {line.issueType?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSideBySide = () => (
    <div className="side-by-side-diff">
      <div className="diff-column original-column">
        <div className="column-header">
          <h4>Original Code (Issues)</h4>
          <span className="line-count">{originalLines.length} lines</span>
        </div>
        <div className="code-content">
          {originalLines.map(line => renderCodeLine(line, 'original'))}
        </div>
      </div>
      
      <div className="diff-column corrected-column">
        <div className="column-header">
          <h4>Corrected Code</h4>
          <span className="line-count">{correctedLines.length} lines</span>
        </div>
        <div className="code-content">
          {correctedLines.map(line => renderCodeLine(line, 'corrected'))}
        </div>
      </div>
    </div>
  );

  const renderSingleView = (lines: CodeLine[], title: string) => (
    <div className="single-view">
      <div className="view-header">
        <h4>{title}</h4>
        <span className="line-count">{lines.length} lines</span>
      </div>
      <div className="code-content">
        {lines.map(line => renderCodeLine(line, viewMode as 'original' | 'corrected'))}
      </div>
    </div>
  );

  return (
    <div className="enhanced-code-diff">
      <div className="diff-controls">
        <div className="view-mode-selector">
          <button 
            className={`view-btn ${viewMode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
          >
            Side by Side
          </button>
          <button 
            className={`view-btn ${viewMode === 'unified' ? 'active' : ''}`}
            onClick={() => setViewMode('unified')}
          >
            Unified
          </button>
          <button 
            className={`view-btn ${viewMode === 'original' ? 'active' : ''}`}
            onClick={() => setViewMode('original')}
          >
            Original Only
          </button>
          <button 
            className={`view-btn ${viewMode === 'corrected' ? 'active' : ''}`}
            onClick={() => setViewMode('corrected')}
          >
            Corrected Only
          </button>
        </div>
        
        <button className="apply-corrections-btn" onClick={onApplyCorrections}>
          Apply All Corrections
        </button>
      </div>

      <div className="diff-content">
        {viewMode === 'side-by-side' && renderSideBySide()}
        {viewMode === 'unified' && renderUnifiedDiff()}
        {viewMode === 'original' && renderSingleView(originalLines, 'Original Code')}
        {viewMode === 'corrected' && renderSingleView(correctedLines, 'Corrected Code')}
      </div>

      {issues.length > 0 && (
        <div className="issues-summary">
          <h4>Issues Found ({issues.length})</h4>
          <div className="issues-list">
            {issues.map((issue, index) => (
              <div key={index} className={`issue-summary issue-${issue.type}`}>
                <div className="issue-info">
                  <span className="issue-line">Line {issue.line}</span>
                  <span className="issue-type">{issue.type.toUpperCase()}</span>
                </div>
                <div className="issue-description">{issue.description}</div>
                <div className="issue-suggestion">{issue.suggestion}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedCodeDiff;