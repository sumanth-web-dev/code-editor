"""
Git service for handling git operations and diff generation.
"""

import os
import subprocess
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class GitDiffLine:
    """Represents a line in a git diff."""
    line_number: int
    content: str
    type: str  # 'added', 'removed', 'context'

@dataclass
class GitDiffResult:
    """Represents the result of a git diff operation."""
    success: bool
    diff_lines: List[GitDiffLine]
    error: Optional[str] = None
    has_changes: bool = False
    added_lines: int = 0
    removed_lines: int = 0

class GitService:
    """Service for handling git operations."""
    
    def __init__(self):
        self.git_available = self._check_git_availability()
    
    def _check_git_availability(self) -> bool:
        """Check if git is available in the system."""
        try:
            result = subprocess.run(['git', '--version'], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            return result.returncode == 0
        except Exception as e:
            logger.warning(f"Git not available: {e}")
            return False
    
    def _run_git_command(self, command: List[str], cwd: str = None) -> Tuple[bool, str, str]:
        """Run a git command and return success, stdout, stderr."""
        try:
            result = subprocess.run(
                ['git'] + command,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=cwd
            )
            return result.returncode == 0, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", "Git command timed out"
        except Exception as e:
            return False, "", str(e)
    
    def is_git_repository(self, path: str = ".") -> bool:
        """Check if the given path is a git repository."""
        if not self.git_available:
            return False
        
        success, _, _ = self._run_git_command(['rev-parse', '--git-dir'], cwd=path)
        return success
    
    def get_current_diff(self, file_path: str = None, staged: bool = False) -> GitDiffResult:
        """
        Get the current git diff.
        
        Args:
            file_path: Specific file to diff (optional)
            staged: Whether to get staged changes (default: unstaged)
        """
        if not self.git_available:
            return GitDiffResult(
                success=False,
                diff_lines=[],
                error="Git is not available on this system"
            )
        
        # Build git diff command
        command = ['diff']
        if staged:
            command.append('--staged')
        
        # Add unified diff format with more context
        command.extend(['--unified=3', '--no-color'])
        
        if file_path:
            command.append(file_path)
        
        success, stdout, stderr = self._run_git_command(command)
        
        if not success:
            return GitDiffResult(
                success=False,
                diff_lines=[],
                error=f"Git diff failed: {stderr}"
            )
        
        # Parse the diff output
        diff_lines = self._parse_diff_output(stdout)
        
        # Calculate statistics
        added_lines = sum(1 for line in diff_lines if line.type == 'added')
        removed_lines = sum(1 for line in diff_lines if line.type == 'removed')
        has_changes = len(diff_lines) > 0
        
        return GitDiffResult(
            success=True,
            diff_lines=diff_lines,
            has_changes=has_changes,
            added_lines=added_lines,
            removed_lines=removed_lines
        )
    
    def _parse_diff_output(self, diff_output: str) -> List[GitDiffLine]:
        """Parse git diff output into structured diff lines."""
        lines = diff_output.split('\n')
        diff_lines = []
        line_number = 0
        
        for line in lines:
            line_number += 1
            
            if line.startswith('+++') or line.startswith('---'):
                # File headers
                continue
            elif line.startswith('@@'):
                # Hunk headers
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line,
                    type='context'
                ))
            elif line.startswith('+'):
                # Added lines
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line[1:],  # Remove the + prefix
                    type='added'
                ))
            elif line.startswith('-'):
                # Removed lines
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line[1:],  # Remove the - prefix
                    type='removed'
                ))
            elif line.startswith(' ') or line == '':
                # Context lines
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line[1:] if line.startswith(' ') else line,
                    type='context'
                ))
        
        return diff_lines
    
    def get_file_status(self, file_path: str = None) -> Dict[str, str]:
        """Get the status of files in the repository."""
        if not self.git_available:
            return {}
        
        command = ['status', '--porcelain']
        if file_path:
            command.append(file_path)
        
        success, stdout, stderr = self._run_git_command(command)
        
        if not success:
            logger.error(f"Git status failed: {stderr}")
            return {}
        
        # Parse status output
        status_map = {}
        for line in stdout.strip().split('\n'):
            if len(line) >= 3:
                status_code = line[:2]
                file_name = line[3:]
                status_map[file_name] = status_code.strip()
        
        return status_map
    
    def create_diff_from_code_changes(self, original_code: str, modified_code: str) -> List[GitDiffLine]:
        """Create a diff from two code strings (useful for showing AI-generated changes)."""
        import difflib
        
        original_lines = original_code.split('\n')
        modified_lines = modified_code.split('\n')
        
        diff_lines = []
        line_number = 0
        
        # Use difflib to generate unified diff
        diff = difflib.unified_diff(
            original_lines,
            modified_lines,
            fromfile='original',
            tofile='modified',
            lineterm=''
        )
        
        for line in diff:
            line_number += 1
            
            if line.startswith('+++') or line.startswith('---'):
                continue
            elif line.startswith('@@'):
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line,
                    type='context'
                ))
            elif line.startswith('+'):
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line[1:],
                    type='added'
                ))
            elif line.startswith('-'):
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line[1:],
                    type='removed'
                ))
            else:
                diff_lines.append(GitDiffLine(
                    line_number=line_number,
                    content=line[1:] if line.startswith(' ') else line,
                    type='context'
                ))
        
        return diff_lines

# Global service instance
git_service = GitService()