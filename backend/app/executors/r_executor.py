"""
R code executor implementation.
"""

import re
import os
import logging
from typing import Optional
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class RExecutor(BaseExecutor):
    """Executor for R code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize R executor."""
        super().__init__("r", timeout)
    
    def get_file_extension(self) -> str:
        """Get R file extension."""
        return ".r"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute R file."""
        return ["Rscript", "--vanilla", file_path]
    
    def wrap_code_if_needed(self, code: str) -> str:
        """
        R code doesn't need wrapping, but we can add some safety measures.
        
        Args:
            code: R source code
            
        Returns:
            Code with optional safety measures
        """
        # Add error handling wrapper for better error reporting
        wrapped_code = f"""
# Set options for better error reporting
options(warn = 1)
options(error = function() {{
    traceback(2)
    quit(status = 1)
}})

# User code starts here
{code}
"""
        return wrapped_code
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse R error output to extract structured error information.
        
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
        
        # Parse R error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for R syntax errors
        if "syntax error" in error_text.lower() or "unexpected" in error_text.lower():
            error_type = "syntax_error"
            
            # Extract line number from syntax error
            line_match = re.search(r'line (\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            if "unexpected" in error_text.lower():
                error_message = "Syntax error: unexpected token or symbol"
        
        # Look for R runtime errors
        elif "error:" in error_text.lower() or "error in" in error_text.lower():
            error_type = "runtime_error"
            
            # Extract error message
            error_match = re.search(r'error[:\s]+(.+)', error_text, re.IGNORECASE | re.MULTILINE)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for object not found errors
        elif "object" in error_text.lower() and "not found" in error_text.lower():
            error_type = "name_error"
            error_message = "Object not found - variable or function not defined"
        
        # Look for package loading errors
        elif "there is no package called" in error_text.lower():
            error_type = "import_error"
            error_message = "Package not found - required R package is not installed"
        
        # Look for function not found errors
        elif "could not find function" in error_text.lower():
            error_type = "name_error"
            error_message = "Function not found - function name may be misspelled or package not loaded"
        
        # Look for argument errors
        elif "argument" in error_text.lower() and ("missing" in error_text.lower() or "unused" in error_text.lower()):
            error_type = "argument_error"
            if "missing" in error_text.lower():
                error_message = "Missing argument - function call is missing required arguments"
            else:
                error_message = "Unused argument - function call has extra or incorrect arguments"
        
        # Look for data type errors
        elif any(keyword in error_text.lower() for keyword in 
                ["invalid type", "non-numeric", "non-conformable", "subscript out of bounds"]):
            error_type = "type_error"
            if "subscript out of bounds" in error_text.lower():
                error_message = "Index out of bounds - trying to access non-existent array element"
            elif "non-numeric" in error_text.lower():
                error_message = "Type error - non-numeric argument to mathematical function"
            else:
                error_message = "Type error - invalid data type for operation"
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_r_code(self, code: str) -> Optional[str]:
        """
        Validate R code for basic security issues.
        
        Args:
            code: R code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous R operations
        dangerous_patterns = [
            r'\bsystem\s*\(',
            r'\bsystem2\s*\(',
            r'\bshell\s*\(',
            r'\bshell\.exec\s*\(',
            r'\bfile\.remove\s*\(',
            r'\bfile\.copy\s*\(',
            r'\bfile\.rename\s*\(',
            r'\bunlink\s*\(',
            r'\bdir\.create\s*\(',
            r'\bsetwd\s*\(',
            r'\bgetwd\s*\(',
            r'\bSys\.setenv\s*\(',
            r'\bSys\.unsetenv\s*\(',
            r'\bquit\s*\(',
            r'\bq\s*\(',
            r'\bstop\s*\(',
            r'\bsource\s*\(',
            r'\beval\s*\(',
            r'\bparse\s*\(',
            r'\bdo\.call\s*\(',
            r'\binstall\.packages\s*\(',
            r'\bremove\.packages\s*\(',
            r'\blibrary\s*\(',
            r'\brequire\s*\(',
            r'\battach\s*\(',
            r'\bdetach\s*\(',
            r'\bload\s*\(',
            r'\bsave\s*\(',
            r'\bsaveRDS\s*\(',
            r'\breadRDS\s*\(',
            r'\bwrite\.',
            r'\bread\.',
            r'\bconnections\s*\(',
            r'\bfile\s*\(',
            r'\burl\s*\(',
            r'\bgzfile\s*\(',
            r'\bbzfile\s*\(',
            r'\bxzfile\s*\(',
            r'\bpipe\s*\(',
            r'\bfifo\s*\(',
            r'\bsocketConnection\s*\(',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous assignments to system variables
        dangerous_assignments = [
            r'\.libPaths\s*<-',
            r'options\s*\(',
            r'Sys\.setenv\s*\(',
        ]
        
        for pattern in dangerous_assignments:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe assignment: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute R code with additional validation.
        
        Args:
            code: R code to execute
            input_data: Optional input data (not commonly used in R)
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Validate code for security issues
            validation_error = self.validate_r_code(code)
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
            
            # Wrap code with error handling
            wrapped_code = self.wrap_code_if_needed(code)
            
            # Create temporary file
            file_path = self.create_temp_file(wrapped_code)
            
            # Execute R script
            stdout, stderr, return_code, timed_out = self.execute_with_timeout(
                self.get_execution_command(file_path), input_data
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
            logger.error(f"R executor error: {e}")
            
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