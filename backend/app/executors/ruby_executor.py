"""
Ruby code executor implementation.
"""

import re
import logging
from typing import Optional
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class RubyExecutor(BaseExecutor):
    """Executor for Ruby code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize Ruby executor."""
        super().__init__("ruby", timeout)
    
    def get_file_extension(self) -> str:
        """Get Ruby file extension."""
        return ".rb"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute Ruby file."""
        return ["ruby", file_path]
    
    def check_ruby_availability(self) -> bool:
        """
        Check if Ruby interpreter is available.
        
        Returns:
            True if Ruby is available, False otherwise
        """
        try:
            result = __import__('subprocess').run(
                ["ruby", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, __import__('subprocess').TimeoutExpired):
            return False
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse Ruby error output to extract structured error information.
        
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
        
        # Parse Ruby error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for syntax errors
        if "SyntaxError" in error_text:
            error_type = "syntax_error"
            
            # Extract line number from syntax error
            line_match = re.search(r':(\d+):\s*syntax error', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'syntax error,\s*(.+)', error_text)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for runtime errors
        elif any(error in error_text for error in ["Error", "Exception"]):
            # Look for specific Ruby exceptions
            exception_patterns = [
                (r'(NoMethodError)', "no_method_error"),
                (r'(NameError)', "name_error"),
                (r'(ArgumentError)', "argument_error"),
                (r'(TypeError)', "type_error"),
                (r'(RuntimeError)', "runtime_error"),
                (r'(StandardError)', "standard_error"),
                (r'(LoadError)', "load_error"),
                (r'(IOError)', "io_error"),
                (r'(SystemCallError)', "system_call_error"),
                (r'(ZeroDivisionError)', "zero_division_error"),
                (r'(FloatDomainError)', "float_domain_error"),
                (r'(RangeError)', "range_error"),
                (r'(RegexpError)', "regexp_error"),
                (r'(ThreadError)', "thread_error"),
                (r'(FiberError)', "fiber_error"),
                (r'(Interrupt)', "interrupt"),
                (r'(SystemExit)', "system_exit"),
                (r'(SystemStackError)', "system_stack_error"),
                (r'(SecurityError)', "security_error"),
                (r'(\w+Error)', "error"),
            ]
            
            for pattern, exception_type in exception_patterns:
                match = re.search(pattern, error_text)
                if match:
                    error_type = exception_type
                    break
            
            # Look for line number in stack trace
            line_match = re.search(r':(\d+):in', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract exception message
            exception_match = re.search(r'(\w+(?:Error|Exception)):\s*(.+)', error_text)
            if exception_match:
                error_message = exception_match.group(2).strip()
            else:
                # Try to get the first line of the error
                lines = error_text.split('\n')
                for line in lines:
                    if any(keyword in line for keyword in ['Error', 'Exception']) and ':' in line:
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            error_message = parts[1].strip()
                            break
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_ruby_code(self, code: str) -> Optional[str]:
        """
        Validate Ruby code for basic security issues.
        
        Args:
            code: Ruby code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous Ruby methods
        dangerous_patterns = [
            r'\bsystem\s*\(',
            r'\bexec\s*\(',
            r'\b`[^`]*`',  # Backticks for command execution
            r'\b%x\[',     # %x[] for command execution
            r'\beval\s*\(',
            r'\binstance_eval\s*\(',
            r'\bclass_eval\s*\(',
            r'\bmodule_eval\s*\(',
            r'\bload\s*\(',
            r'\brequire\s*\(',
            r'\bautoload\s*\(',
            r'\bFile\.open\s*\(',
            r'\bFile\.read\s*\(',
            r'\bFile\.write\s*\(',
            r'\bFile\.delete\s*\(',
            r'\bFile\.unlink\s*\(',
            r'\bDir\.delete\s*\(',
            r'\bDir\.rmdir\s*\(',
            r'\bFileUtils\.',
            r'\bIO\.popen\s*\(',
            r'\bOpen3\.',
            r'\bKernel\.system\s*\(',
            r'\bKernel\.exec\s*\(',
            r'\bKernel\.eval\s*\(',
            r'\bKernel\.load\s*\(',
            r'\bKernel\.require\s*\(',
            r'\bKernel\.autoload\s*\(',
            r'\bProcess\.spawn\s*\(',
            r'\bProcess\.exec\s*\(',
            r'\bProcess\.fork\s*\(',
            r'\bThread\.new\s*\(',
            r'\bThread\.start\s*\(',
            r'\bFiber\.new\s*\(',
            r'\bObjectSpace\.',
            r'\bGC\.',
            r'\bTracePoint\.',
            r'\bMethod\#call',
            r'\bUnboundMethod\#bind',
            r'\bproc\s*\{',
            r'\blambda\s*\{',
            r'\b->\s*\{',
            r'\bdefine_method\s*\(',
            r'\bdefine_singleton_method\s*\(',
            r'\balias_method\s*\(',
            r'\bundef_method\s*\(',
            r'\bremove_method\s*\(',
            r'\bsend\s*\(',
            r'\b__send__\s*\(',
            r'\bpublic_send\s*\(',
            r'\bmethod\s*\(',
            r'\bpublic_method\s*\(',
            r'\bsingleton_method\s*\(',
            r'\bconst_get\s*\(',
            r'\bconst_set\s*\(',
            r'\bconst_defined\?\s*\(',
            r'\bremove_const\s*\(',
            r'\bclass_variable_get\s*\(',
            r'\bclass_variable_set\s*\(',
            r'\binstance_variable_get\s*\(',
            r'\binstance_variable_set\s*\(',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous require statements
        dangerous_requires = [
            r'require\s+[\'"]fileutils[\'"]',
            r'require\s+[\'"]open3[\'"]',
            r'require\s+[\'"]net/http[\'"]',
            r'require\s+[\'"]socket[\'"]',
            r'require\s+[\'"]uri[\'"]',
            r'require\s+[\'"]open-uri[\'"]',
            r'require\s+[\'"]tempfile[\'"]',
            r'require\s+[\'"]tmpdir[\'"]',
        ]
        
        for pattern in dangerous_requires:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe require: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute Ruby code with additional validation.
        
        Args:
            code: Ruby code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Check if Ruby interpreter is available
            if not self.check_ruby_availability():
                return ExecutionResult(
                    success=False,
                    error=ExecutionError(
                        type="runtime_error",
                        message="Ruby interpreter not found. Please install Ruby.",
                        details="Ruby interpreter is required to execute Ruby code."
                    ).to_dict(),
                    execution_time=0.0
                )
            
            # Validate code for security issues
            validation_error = self.validate_ruby_code(code)
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
            
            # Create temporary file with code
            file_path = self.create_temp_file(code)
            
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
            logger.error(f"Ruby executor error: {e}")
            
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