"""
PHP code executor implementation.
"""

import re
import logging
from typing import Optional
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class PhpExecutor(BaseExecutor):
    """Executor for PHP code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize PHP executor."""
        super().__init__("php", timeout)
    
    def get_file_extension(self) -> str:
        """Get PHP file extension."""
        return ".php"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute PHP file."""
        return ["php", file_path]
    
    def wrap_code_if_needed(self, code: str) -> str:
        """
        Wrap code in PHP tags if needed.
        
        Args:
            code: PHP source code
            
        Returns:
            Wrapped code with PHP tags
        """
        # Check if code already has PHP opening tag
        if code.strip().startswith('<?php') or code.strip().startswith('<?'):
            return code
        
        # Wrap code in PHP tags
        wrapped_code = f"<?php\n{code}"
        return wrapped_code
    
    def check_php_availability(self) -> bool:
        """
        Check if PHP interpreter is available.
        
        Returns:
            True if PHP is available, False otherwise
        """
        try:
            result = __import__('subprocess').run(
                ["php", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, __import__('subprocess').TimeoutExpired):
            return False
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse PHP error output to extract structured error information.
        
        Args:
            stderr: Standard error output
            stdout: Standard output
            
        Returns:
            ExecutionError object or None if no error
        """
        if not stderr.strip() and not stdout.strip():
            return None
        
        error_text = stderr.strip()
        if not error_text:
            error_text = stdout.strip()
        
        if not error_text:
            return None
        
        # Parse PHP error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for PHP parse errors
        if "Parse error:" in error_text:
            error_type = "parse_error"
            
            # Extract line number from parse error
            line_match = re.search(r'on line (\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'Parse error:\s*(.+?)\s+in', error_text)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for PHP fatal errors
        elif "Fatal error:" in error_text:
            error_type = "fatal_error"
            
            # Extract line number from fatal error
            line_match = re.search(r'on line (\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'Fatal error:\s*(.+?)\s+in', error_text)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for PHP warnings
        elif "Warning:" in error_text:
            error_type = "warning"
            
            # Extract line number from warning
            line_match = re.search(r'on line (\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract warning message
            warning_match = re.search(r'Warning:\s*(.+?)\s+in', error_text)
            if warning_match:
                error_message = warning_match.group(1).strip()
        
        # Look for PHP notices
        elif "Notice:" in error_text:
            error_type = "notice"
            
            # Extract line number from notice
            line_match = re.search(r'on line (\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract notice message
            notice_match = re.search(r'Notice:\s*(.+?)\s+in', error_text)
            if notice_match:
                error_message = notice_match.group(1).strip()
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_php_code(self, code: str) -> Optional[str]:
        """
        Validate PHP code for basic security issues.
        
        Args:
            code: PHP code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous PHP functions
        dangerous_patterns = [
            r'\bexec\s*\(',
            r'\bshell_exec\s*\(',
            r'\bsystem\s*\(',
            r'\bpassthru\s*\(',
            r'\bpopen\s*\(',
            r'\bproc_open\s*\(',
            r'\beval\s*\(',
            r'\bassert\s*\(',
            r'\bfile_get_contents\s*\(',
            r'\bfile_put_contents\s*\(',
            r'\bfopen\s*\(',
            r'\bfwrite\s*\(',
            r'\bunlink\s*\(',
            r'\brmdir\s*\(',
            r'\bmkdir\s*\(',
            r'\bchmod\s*\(',
            r'\bchown\s*\(',
            r'\bmove_uploaded_file\s*\(',
            r'\bcurl_exec\s*\(',
            r'\bfsockopen\s*\(',
            r'\bsocket_create\s*\(',
            r'\bmysql_connect\s*\(',
            r'\bmysqli_connect\s*\(',
            r'\bPDO\s*\(',
            r'\b__construct\s*\(',
            r'\b__destruct\s*\(',
            r'\b__call\s*\(',
            r'\b__callStatic\s*\(',
            r'\b__get\s*\(',
            r'\b__set\s*\(',
            r'\b__isset\s*\(',
            r'\b__unset\s*\(',
            r'\b__sleep\s*\(',
            r'\b__wakeup\s*\(',
            r'\b__toString\s*\(',
            r'\b__invoke\s*\(',
            r'\b__set_state\s*\(',
            r'\b__clone\s*\(',
            r'\b__debugInfo\s*\(',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous superglobals and variables
        dangerous_globals = [
            r'\$_GET\b',
            r'\$_POST\b',
            r'\$_REQUEST\b',
            r'\$_FILES\b',
            r'\$_SERVER\b',
            r'\$_ENV\b',
            r'\$_COOKIE\b',
            r'\$_SESSION\b',
            r'\$GLOBALS\b',
        ]
        
        for pattern in dangerous_globals:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe global variable: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute PHP code with additional validation.
        
        Args:
            code: PHP code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Check if PHP interpreter is available
            if not self.check_php_availability():
                return ExecutionResult(
                    success=False,
                    error=ExecutionError(
                        type="runtime_error",
                        message="PHP interpreter not found. Please install PHP.",
                        details="PHP interpreter is required to execute PHP code."
                    ).to_dict(),
                    execution_time=0.0
                )
            
            # Validate code for security issues
            validation_error = self.validate_php_code(code)
            if validation_error:
                return ExecutionResult(
                    success=False,
                    error=ExecutionError(
                        type="security_error",
                        message="Code validation failed",
                        details=validation_error
                    ).to_dict(),
                    execution_time=0.0
                )
            
            # Wrap code if needed
            wrapped_code = self.wrap_code_if_needed(code)
            
            # Create temporary file with wrapped code
            file_path = self.create_temp_file(wrapped_code)
            
            # Get execution command
            command = self.get_execution_command(file_path)
            
            # Execute the command
            stdout, stderr, return_code, timed_out = self.execute_with_timeout(
                command, input_data, cwd=self.temp_dir
            )
            
            execution_time = __import__('time').time() - start_time
            
            # Handle timeout
            if timed_out:
                return ExecutionResult(
                    success=False,
                    output=stdout,
                    error=ExecutionError(
                        type="timeout_error",
                        message=f"Code execution timed out after {self.timeout} seconds",
                        details=stderr
                    ).to_dict(),
                    execution_time=execution_time,
                    timeout=True
                )
            
            # Handle execution errors
            if return_code != 0 or stderr.strip():
                error = self.parse_error_output(stderr, stdout)
                return ExecutionResult(
                    success=False,
                    output=stdout,
                    error=error.to_dict() if error else None,
                    execution_time=execution_time
                )
            
            # Success case
            return ExecutionResult(
                success=True,
                output=stdout,
                execution_time=execution_time
            )
            
        except Exception as e:
            execution_time = __import__('time').time() - start_time
            logger.error(f"PHP executor error: {e}")
            
            return ExecutionResult(
                success=False,
                error=ExecutionError(
                    type="executor_error",
                    message=f"Internal executor error: {str(e)}",
                    details=str(e)
                ).to_dict(),
                execution_time=execution_time
            )
        
        finally:
            # Always cleanup temporary files
            self.cleanup_temp_files()