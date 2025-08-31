import React, { useState } from 'react';
import { analysisService } from '../services/analysisService';

/**
 * Test component to verify git service integration
 * This can be temporarily added to the editor for testing
 */
const GitIntegrationTest: React.FC = () => {
  const [testResults, setTestResults] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testGitIntegration = async () => {
    setLoading(true);
    setTestResults('Testing git integration...\n');

    try {
      // Test 1: Git Status
      setTestResults(prev => prev + '1. Testing git status...\n');
      const statusResponse = await analysisService.getGitStatus();
      
      if (statusResponse.success) {
        const status = statusResponse.git_status;
        setTestResults(prev => prev + 
          `✅ Git status: ${status?.is_git_repo ? 'In git repo' : 'Not in git repo'}\n` +
          `   Has changes: ${status?.has_changes ? 'Yes' : 'No'}\n` +
          `   Files: ${status?.files ? Object.keys(status.files).length : 0}\n\n`
        );
      } else {
        setTestResults(prev => prev + `❌ Git status failed: ${statusResponse.error}\n\n`);
      }

      // Test 2: Git Diff (unstaged)
      setTestResults(prev => prev + '2. Testing git diff (unstaged)...\n');
      const diffResponse = await analysisService.getGitDiff();
      
      if (diffResponse.success) {
        const diff = diffResponse.git_diff;
        setTestResults(prev => prev + 
          `✅ Git diff: ${diff?.has_changes ? 'Has changes' : 'No changes'}\n` +
          `   Added lines: ${diff?.added_lines || 0}\n` +
          `   Removed lines: ${diff?.removed_lines || 0}\n` +
          `   Diff lines: ${diff?.diff_lines?.length || 0}\n\n`
        );
      } else {
        setTestResults(prev => prev + `❌ Git diff failed: ${diffResponse.error}\n\n`);
      }

      // Test 3: Git Diff (staged)
      setTestResults(prev => prev + '3. Testing git diff (staged)...\n');
      const stagedDiffResponse = await analysisService.getGitDiff(undefined, true);
      
      if (stagedDiffResponse.success) {
        const diff = stagedDiffResponse.git_diff;
        setTestResults(prev => prev + 
          `✅ Staged git diff: ${diff?.has_changes ? 'Has changes' : 'No changes'}\n` +
          `   Added lines: ${diff?.added_lines || 0}\n` +
          `   Removed lines: ${diff?.removed_lines || 0}\n\n`
        );
      } else {
        setTestResults(prev => prev + `❌ Staged git diff failed: ${stagedDiffResponse.error}\n\n`);
      }

      // Test 4: Code Analysis with Git Integration
      setTestResults(prev => prev + '4. Testing code analysis with git integration...\n');
      const analysisResponse = await analysisService.analyzeCode({
        code: 'print("Hello, World!")',
        language: 'python',
        explain_level: 'short'
      });

      if (analysisResponse.success) {
        setTestResults(prev => prev + 
          `✅ Code analysis successful\n` +
          `   Git diff included: ${analysisResponse.git_diff ? 'Yes' : 'No'}\n` +
          `   Git changes: ${analysisResponse.git_diff?.has_changes ? 'Yes' : 'No'}\n\n`
        );
      } else {
        setTestResults(prev => prev + `❌ Code analysis failed: ${analysisResponse.error}\n\n`);
      }

      setTestResults(prev => prev + '🎉 Git integration test completed!\n');

    } catch (error: any) {
      setTestResults(prev => prev + `❌ Test failed with error: ${error.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '20px', 
      left: '20px', 
      background: '#1e1e1e', 
      border: '1px solid #3c3c3c',
      borderRadius: '8px',
      padding: '16px',
      color: '#d4d4d4',
      fontFamily: 'monospace',
      fontSize: '12px',
      maxWidth: '400px',
      maxHeight: '300px',
      overflow: 'auto',
      zIndex: 1001
    }}>
      <div style={{ marginBottom: '12px' }}>
        <strong>Git Integration Test</strong>
      </div>
      
      <button 
        onClick={testGitIntegration}
        disabled={loading}
        style={{
          background: '#0e639c',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '12px'
        }}
      >
        {loading ? 'Testing...' : 'Run Git Test'}
      </button>

      <pre style={{ 
        whiteSpace: 'pre-wrap', 
        margin: 0, 
        fontSize: '11px',
        lineHeight: '1.4'
      }}>
        {testResults}
      </pre>
    </div>
  );
};

export default GitIntegrationTest;