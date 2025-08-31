import React, { useState, useEffect } from 'react';
import { analysisService, GitStatusData } from '../services/analysisService';
import GitDiffViewer from './GitDiffViewer';
import './GitStatusIndicator.css';

interface GitStatusIndicatorProps {
  className?: string;
}

const GitStatusIndicator: React.FC<GitStatusIndicatorProps> = ({ className }) => {
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkGitStatus();
    
    // Auto-refresh git status every 30 seconds
    const interval = setInterval(checkGitStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkGitStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await analysisService.getGitStatus();
      if (response.success) {
        setGitStatus(response.git_status || null);
      } else {
        setError(response.error || 'Failed to check git status');
      }
    } catch (err: any) {
      setError(err.message || 'Git not available');
    } finally {
      setLoading(false);
    }
  };

  const getStatusSummary = () => {
    if (!gitStatus || !gitStatus.has_changes) {
      return { text: 'Clean', count: 0, icon: '✅' };
    }

    const fileCount = Object.keys(gitStatus.files).length;
    const hasUntracked = Object.values(gitStatus.files).some(status => status.includes('??'));
    
    if (hasUntracked) {
      return { text: 'Changes', count: fileCount, icon: '📝' };
    }
    
    return { text: 'Modified', count: fileCount, icon: '📝' };
  };

  const handleClick = () => {
    if (gitStatus && gitStatus.is_git_repo) {
      setShowDiffViewer(true);
    }
  };

  // Hide indicator for expected git-related errors (not in repo, git not available)
  const shouldHideIndicator = error && (
    error.includes('Git not available') ||
    error.includes('Not in a git repository') ||
    error.includes('not a git repository')
  );

  if (shouldHideIndicator) {
    return null; // Don't show indicator for expected git errors
  }

  // Show error indicator only for unexpected git errors
  if (error) {
    return (
      <div className={`git-status-indicator error ${className || ''}`}>
        <span className="git-icon">⚠️</span>
        <span className="git-text">Git Error</span>
      </div>
    );
  }

  if (!gitStatus || !gitStatus.is_git_repo) {
    return null; // Don't show indicator if not in a git repo
  }

  const status = getStatusSummary();

  return (
    <>
      <div 
        className={`git-status-indicator ${gitStatus.has_changes ? 'has-changes' : 'clean'} ${className || ''}`}
        onClick={handleClick}
        title={`Git status: ${status.text}${status.count > 0 ? ` (${status.count} files)` : ''} - Click to view details`}
      >
        <span className="git-icon">{loading ? '⏳' : status.icon}</span>
        <span className="git-text">
          {status.text}
          {status.count > 0 && <span className="file-count">{status.count}</span>}
        </span>
        <button 
          className="refresh-git-button"
          onClick={(e) => {
            e.stopPropagation();
            checkGitStatus();
          }}
          title="Refresh git status"
        >
          🔄
        </button>
      </div>

      {showDiffViewer && (
        <div className="git-diff-modal">
          <div className="git-diff-backdrop" onClick={() => setShowDiffViewer(false)} />
          <div className="git-diff-modal-content">
            <GitDiffViewer onClose={() => setShowDiffViewer(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default GitStatusIndicator;