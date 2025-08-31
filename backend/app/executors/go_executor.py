"""
Go code executor implementation.
"""

import re
import os
import logging
from typing import Optional, Tuple
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class GoExecutor(BaseExecutor):
    """Executor for Go code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize Go executor."""
        super().__init__("go", timeout)
    
    def get_file_extension(self) -> str:
        """Get Go file extension."""
        return ".go"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute Go file."""
        return ["go", "run", file_path]
    
    def wrap_code_if_needed(self, code: str) -> str:
        """
        Wrap code in a main function if it doesn't have one.
        
        Args:
            code: Go source code
            
        Returns:
            Wrapped code with main function
        """
        # Check if code already has a main function
        if re.search(r'\bfunc\s+main\s*\(\s*\)', code):
            return code
        
        # Check if code has package declaration
        has_package = re.search(r'^\s*package\s+\w+', code, re.MULTILINE)
        
        # Wrap code in a main function with necessary package and imports
        package_and_imports = ""
        if not has_package:
            package_and_imports = "package main\n\n"
            
            # Add common imports if they seem to be needed
            if any(keyword in code for keyword in ['fmt.', 'Println', 'Printf', 'Print']):
                package_and_imports += 'import "fmt"\n\n'
        
        wrapped_code = f"""{package_and_imports}func main() {{
{self.indent_code(code, 4)}
}}
"""
        return wrapped_code
    
    def indent_code(self, code: str, spaces: int) -> str:
        """
        Indent code by the specified number of spaces.
        
        Args:
            code: Code to indent
            spaces: Number of spaces to indent
            
        Returns:
            Indented code
        """
        indent = " " * spaces
        lines = code.split('\n')
        indented_lines = [indent + line if line.strip() else line for line in lines]
        return '\n'.join(indented_lines)
    
    def check_go_availability(self) -> bool:
        """
        Check if Go compiler is available.
        
        Returns:
            True if Go is available, False otherwise
        """
        try:
            result = __import__('subprocess').run(
                ["go", "version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, __import__('subprocess').TimeoutExpired):
            return False
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse Go error output to extract structured error information.
        
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
        
        # Parse Go error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for compilation errors
        if "syntax error:" in error_text.lower():
            error_type = "syntax_error"
            
            # Extract line number from syntax error
            line_match = re.search(r':(\d+):(?:\d+:)?\s*syntax error', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'syntax error:\s*(.+)', error_text)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for other compilation errors
        elif re.search(r':\d+:\d+:', error_text):
            error_type = "compilation_error"
            
            # Extract line number from compilation error
            line_match = re.search(r':(\d+):(?:\d+:)?', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message (everything after line:col:)
            error_match = re.search(r':\d+:\d+:\s*(.+)', error_text)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for runtime panics
        elif "panic:" in error_text:
            error_type = "panic"
            
            # Look for line number in stack trace
            line_match = re.search(r'\.go:(\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract panic message
            panic_match = re.search(r'panic:\s*(.+)', error_text)
            if panic_match:
                error_message = panic_match.group(1).strip()
        
        # Look for runtime errors
        elif "runtime error:" in error_text:
            error_type = "runtime_error"
            
            # Look for line number in stack trace
            line_match = re.search(r'\.go:(\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract runtime error message
            runtime_match = re.search(r'runtime error:\s*(.+)', error_text)
            if runtime_match:
                error_message = runtime_match.group(1).strip()
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_go_code(self, code: str) -> Optional[str]:
        """
        Validate Go code for basic security issues.
        
        Args:
            code: Go code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous Go operations
        dangerous_patterns = [
            r'\bos\.Exec\s*\(',
            r'\bexec\.Command\s*\(',
            r'\bexec\.CommandContext\s*\(',
            r'\bos\.Exit\s*\(',
            r'\bos\.Remove\s*\(',
            r'\bos\.RemoveAll\s*\(',
            r'\bos\.Rename\s*\(',
            r'\bos\.Mkdir\s*\(',
            r'\bos\.MkdirAll\s*\(',
            r'\bos\.Chmod\s*\(',
            r'\bos\.Chown\s*\(',
            r'\bos\.Chdir\s*\(',
            r'\bos\.Setenv\s*\(',
            r'\bos\.Unsetenv\s*\(',
            r'\bioutil\.WriteFile\s*\(',
            r'\bos\.OpenFile\s*\(',
            r'\bos\.Create\s*\(',
            r'\bnet\.Dial\s*\(',
            r'\bnet\.Listen\s*\(',
            r'\bhttp\.Get\s*\(',
            r'\bhttp\.Post\s*\(',
            r'\bhttp\.ListenAndServe\s*\(',
            r'\bunsafe\.',
            r'\breflect\.',
            r'\bsyscall\.',
            r'\bplugin\.',
            r'\bdebug\.',
            r'\bruntime\.',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous imports
        dangerous_imports = [
            r'import\s+"os/exec"',
            r'import\s+"syscall"',
            r'import\s+"unsafe"',
            r'import\s+"plugin"',
            r'import\s+"net"',
            r'import\s+"net/http"',
            r'import\s+"io/ioutil"',
            r'import\s+"os"',
            r'import\s+"reflect"',
            r'import\s+"runtime"',
            r'import\s+"debug"',
        ]
        
        for pattern in dangerous_imports:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe import: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute Go code with additional validation.
        
        Args:
            code: Go code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Check if Go compiler is available
            if not self.check_go_availability():
                return ExecutionResult(
                    success=False,
                    error=ExecutionError(
                        type="runtime_error",
                        message="Go compiler not found. Please install Go.",
                        details="Go compiler is required to execute Go code."
                    ).to_dict(),
                    execution_time=0.0
                )
            
            # Set Go environment variables for cache and modules
            import os
            env = os.environ.copy()
            
            # Ensure cache directories exist and are writable
            cache_dir = '/home/appuser/.cache/go-build'
            gopath_dir = '/home/appuser/.local/go'
            
            # Ensure temp_dir is available
            if self.temp_dir is None:
                import tempfile
                self.temp_dir = tempfile.mkdtemp(prefix="go_", dir="/tmp")
            
            try:
                os.makedirs(cache_dir, exist_ok=True)
                os.makedirs(gopath_dir, exist_ok=True)
                os.chmod(cache_dir, 0o755)
                os.chmod(gopath_dir, 0o755)
            except (OSError, PermissionError):
                # Fallback to temp directory
                cache_dir = os.path.join(self.temp_dir, 'go-cache')
                gopath_dir = os.path.join(self.temp_dir, 'go-path')
                os.makedirs(cache_dir, exist_ok=True)
                os.makedirs(gopath_dir, exist_ok=True)
            
            env['GOCACHE'] = cache_dir
            env['GOPATH'] = gopath_dir
            env['GO111MODULE'] = 'off'  # Disable modules for simple scripts
            env['GOTMPDIR'] = self.temp_dir  # Use our temp directory
            
            # Validate code for security issues
            validation_error = self.validate_go_code(code)
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
            file_path = self.create_temp_file(wrapped_code, "main.go")
            
            # Get execution command
            command = self.get_execution_command(file_path)
            
            # Execute the command with Go environment
            stdout, stderr, return_code, timed_out = self.execute_with_timeout(
                command, input_data, cwd=self.temp_dir, env=env
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
            logger.error(f"Go executor error: {e}")
            
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