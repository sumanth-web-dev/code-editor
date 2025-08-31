import React, { useState, useEffect } from 'react';
import { analysisService, GitDiffData, GitStatusData } from '../services/analysisService';
import { getErrorMessage } from '../utils/errorUtils';
import LoadingSpinner from './LoadingSpinner';
import './GitDiffViewer.css';

interface GitDiffViewerProps {
  onClose?: () => void;
  filePath?: string;
}

const GitDiffViewer: React.FC<GitDiffViewerProps> = ({ onClose, filePath }) => {
  const [gitDiff, setGitDiff] = useState<GitDiffData | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStaged, setShowStaged] = useState(false);

  useEffect(() => {
    loadGitData();
  }, [filePath, showStaged]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGitData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load git diff
      const diffResponse = await analysisService.getGitDiff(filePath, showStaged);
      if (diffResponse.success) {
        setGitDiff(diffResponse.git_diff || null);
      } else {
        setError(diffResponse.error || 'Failed to load git diff');
      }

      // Load git status
      const statusResponse = await analysisService.getGitStatus();
      if (statusResponse.success) {
        setGitStatus(statusResponse.git_status || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load git information');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.trim()) {
      case 'M': return '📝'; // Modified
      case 'A': return '➕'; // Added
      case 'D': return '❌'; // Deleted
      case 'R': return '🔄'; // Renamed
      case 'C': return '📋'; // Copied
      case '??': return '❓'; // Untracked
      default: return '📄';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.trim()) {
      case 'M': return 'Modified';
      case 'A': return 'Added';
      case 'D': return 'Deleted';
      case 'R': return 'Renamed';
      case 'C': return 'Copied';
      case '??': return 'Untracked';
      default: return 'Unknown';
    }
  };

  const renderDiffLine = (line: any, index: number) => {
    const lineClass = `diff-line diff-line-${line.type}`;
    return (
      <div key={index} className={lineClass}>
        <span className="line-number">{line.line_number}</span>
        <span className="line-content">{line.content}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="git-diff-viewer">
        <div className="git-diff-header">
          <h3>Git Changes</h3>
          {onClose && <button className="close-button" onClick={onClose}>×</button>}
        </div>
        <div className="git-diff-loading">
          <LoadingSpinner type="loading" message="Loading git information..." />
        </div>
      </div>
    );
  }

  if (error) {
    const isGitRepoError = error.includes('Not in a git repository') || error.includes('not a git repository');
    
    return (
      <div className="git-diff-viewer">
        <div className="git-diff-header">
          <h3>Git Changes</h3>
          {onClose && <button className="close-button" onClick={onClose}>×</button>}
        </div>
        <div className="git-diff-error">
          {isGitRepoError ? (
            <>
              <p>📁 This directory is not a git repository</p>
              <p>Initialize a git repository to use git features:</p>
              <code>git init</code>
            </>
          ) : (
            <>
              <p>⚠️ {getErrorMessage(error)}</p>
              <button onClick={loadGitData} className="retry-button">Retry</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="git-diff-viewer">
      <div className="git-diff-header">
        <h3>Git Changes</h3>
        <div className="git-diff-controls">
          <label className="staged-toggle">
            <input
              type="checkbox"
              checked={showStaged}
              onChange={(e) => setShowStaged(e.target.checked)}
            />
            Show staged changes
          </label>
          <button onClick={loadGitData} className="refresh-button" title="Refresh">
            🔄
          </button>
          {onClose && <button className="close-button" onClick={onClose}>×</button>}
        </div>
      </div>

      <div className="git-diff-content">
        {/* Git Status Section */}
        {gitStatus && gitStatus.has_changes && (
          <div className="git-status-section">
            <h4>Repository Status</h4>
            <div className="file-status-list">
              {Object.entries(gitStatus.files).map(([filename, status]) => (
                <div key={filename} className="file-status-item">
                  <span className="status-icon">{getStatusIcon(status)}</span>
                  <span className="status-text">{getStatusText(status)}</span>
                  <span className="filename">{filename}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Git Diff Section */}
        {gitDiff && gitDiff.has_changes ? (
          <div className="git-diff-section">
            <div className="diff-summary">
              <h4>Changes {showStaged ? '(Staged)' : '(Unstaged)'}</h4>
              <div className="diff-stats">
                <span className="added-lines">+{gitDiff.added_lines || 0}</span>
                <span className="removed-lines">-{gitDiff.removed_lines || 0}</span>
              </div>
            </div>
            
            <div className="diff-content">
              {gitDiff.diff_lines?.map((line, index) => renderDiffLine(line, index))}
            </div>
          </div>
        ) : (
          <div className="no-changes">
            <p>📄 No {showStaged ? 'staged' : 'unstaged'} changes found</p>
            {gitStatus && !gitStatus.has_changes && (
              <p>Working directory is clean</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GitDiffViewer;