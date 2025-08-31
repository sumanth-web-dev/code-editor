"""
Python code executor implementation.
"""

import re
import logging
from typing import Optional
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError

logger = logging.getLogger(__name__)

class PythonExecutor(BaseExecutor):
    """Executor for Python code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize Python executor."""
        super().__init__("python", timeout)
    
    def get_file_extension(self) -> str:
        """Get Python file extension."""
        return ".py"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute Python file."""
        # Set PYTHONIOENCODING to handle Unicode properly
        return ["python", "-u", file_path]  # -u for unbuffered output
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse Python error output to extract structured error information.
        
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
        
        # Parse Python traceback for line numbers and error types
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for traceback information
        traceback_match = re.search(r'File ".*?", line (\d+)', error_text)
        if traceback_match:
            line_number = int(traceback_match.group(1))
        
        # Look for specific Python error types
        error_patterns = [
            (r'(SyntaxError): (.+)', "syntax_error"),
            (r'(NameError): (.+)', "name_error"),
            (r'(TypeError): (.+)', "type_error"),
            (r'(ValueError): (.+)', "value_error"),
            (r'(IndexError): (.+)', "index_error"),
            (r'(KeyError): (.+)', "key_error"),
            (r'(AttributeError): (.+)', "attribute_error"),
            (r'(ImportError): (.+)', "import_error"),
            (r'(ModuleNotFoundError): (.+)', "module_not_found_error"),
            (r'(IndentationError): (.+)', "indentation_error"),
            (r'(ZeroDivisionError): (.+)', "zero_division_error"),
            (r'(FileNotFoundError): (.+)', "file_not_found_error"),
            (r'(PermissionError): (.+)', "permission_error"),
            (r'(RecursionError): (.+)', "recursion_error"),
            (r'(MemoryError): (.+)', "memory_error"),
            (r'(KeyboardInterrupt): (.+)', "keyboard_interrupt"),
        ]
        
        for pattern, error_type_name in error_patterns:
            match = re.search(pattern, error_text, re.MULTILINE)
            if match:
                error_type = error_type_name
                error_message = match.group(2).strip()
                break
        
        # If no specific error pattern matched, try to extract the last line as the error
        if error_type == "runtime_error":
            lines = error_text.split('\n')
            for line in reversed(lines):
                line = line.strip()
                if line and not line.startswith('File ') and not line.startswith('Traceback'):
                    error_message = line
                    break
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_python_code(self, code: str, allow_input: bool = False) -> Optional[str]:
        """
        Validate Python code for basic security issues.
        
        Args:
            code: Python code to validate
            allow_input: Whether to allow input() function
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous imports and functions
        dangerous_patterns = [
            r'\bos\.system\b',
            r'\bsubprocess\.',
            r'\beval\s*\(',
            r'\bexec\s*\(',
            r'\b__import__\s*\(',
            r'\bopen\s*\(',
            r'\bfile\s*\(',
        ]
        
        # Only block input() if input data is not provided
        if not allow_input:
            dangerous_patterns.append(r'\binput\s*\(')
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for imports that might be dangerous
        dangerous_modules = [
            'os', 'subprocess', 'shutil', 'glob', 'socket', 
            'urllib', 'requests', 'http', 'ftplib', 'smtplib',
            'pickle', 'marshal', 'shelve', 'dbm'
        ]
        
        import_pattern = r'\bimport\s+(\w+)'
        from_import_pattern = r'\bfrom\s+(\w+)\s+import'
        
        for match in re.finditer(import_pattern, code):
            module = match.group(1)
            if module in dangerous_modules:
                return f"Import of potentially unsafe module: {module}"
        
        for match in re.finditer(from_import_pattern, code):
            module = match.group(1)
            if module in dangerous_modules:
                return f"Import from potentially unsafe module: {module}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> 'ExecutionResult':
        """
        Execute Python code with additional validation.
        
        Args:
            code: Python code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        # Validate code for security issues - allow input() if input_data is provided
        validation_error = self.validate_python_code(code, allow_input=input_data is not None)
        if validation_error:
            from app.models.execution import ExecutionResult
            return ExecutionResult(
                success=False,
                error=ExecutionError(
                    type="security_error",
                    message="Code validation failed",
                    details=validation_error
                ).to_dict(),
                execution_time=0.0
            )
        
        # Execute using base class implementation
        return super().execute(code, input_data)