"""
JavaScript/Node.js code executor implementation.
"""

import re
import logging
from typing import Optional
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError

logger = logging.getLogger(__name__)

class JavaScriptExecutor(BaseExecutor):
    """Executor for JavaScript/Node.js code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize JavaScript executor."""
        super().__init__("javascript", timeout)
    
    def get_file_extension(self) -> str:
        """Get JavaScript file extension."""
        return ".js"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute JavaScript file with Node.js."""
        return ["node", file_path]
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse JavaScript error output to extract structured error information.
        
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
        
        # Parse JavaScript error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for line numbers in Node.js error format
        line_match = re.search(r':(\d+):\d+', error_text)
        if line_match:
            line_number = int(line_match.group(1))
        
        # Look for specific JavaScript error types
        error_patterns = [
            (r'SyntaxError: (.+)', "syntax_error"),
            (r'ReferenceError: (.+)', "reference_error"),
            (r'TypeError: (.+)', "type_error"),
            (r'RangeError: (.+)', "range_error"),
            (r'EvalError: (.+)', "eval_error"),
            (r'URIError: (.+)', "uri_error"),
            (r'Error: (.+)', "error"),
        ]
        
        for pattern, error_type_name in error_patterns:
            match = re.search(pattern, error_text, re.MULTILINE)
            if match:
                error_type = error_type_name
                error_message = match.group(1).strip()
                break
        
        # If no specific error pattern matched, try to extract the error message
        if error_type == "runtime_error":
            lines = error_text.split('\n')
            for line in lines:
                line = line.strip()
                if line and not line.startswith('at ') and ':' in line:
                    error_message = line
                    break
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_javascript_code(self, code: str) -> Optional[str]:
        """
        Validate JavaScript code for basic security issues.
        
        Args:
            code: JavaScript code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous Node.js operations
        dangerous_patterns = [
            r'\brequire\s*\(\s*[\'"]fs[\'"]',
            r'\brequire\s*\(\s*[\'"]child_process[\'"]',
            r'\brequire\s*\(\s*[\'"]os[\'"]',
            r'\brequire\s*\(\s*[\'"]path[\'"]',
            r'\brequire\s*\(\s*[\'"]net[\'"]',
            r'\brequire\s*\(\s*[\'"]http[\'"]',
            r'\brequire\s*\(\s*[\'"]https[\'"]',
            r'\brequire\s*\(\s*[\'"]url[\'"]',
            r'\brequire\s*\(\s*[\'"]crypto[\'"]',
            r'\beval\s*\(',
            r'\bFunction\s*\(',
            r'process\.exit',
            r'process\.env',
            r'__dirname',
            r'__filename',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous global objects and methods
        dangerous_globals = [
            r'\bglobal\.',
            r'\bBuffer\.',
            r'\bsetImmediate\s*\(',
            r'\bsetInterval\s*\(',
            # Note: setTimeout is commonly used and relatively safe for short durations
            # r'\bsetTimeout\s*\(',
        ]
        
        for pattern in dangerous_globals:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe global access: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> 'ExecutionResult':
        """
        Execute JavaScript code with additional validation.
        
        Args:
            code: JavaScript code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        # Validate code for security issues
        validation_error = self.validate_javascript_code(code)
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
        
        # If input_data is provided, prepend code to handle it
        if input_data:
            # Create a simple input mechanism for JavaScript
            # Properly escape the input data for JavaScript
            import json
            input_json = json.dumps(input_data)
            input_code = f"""
// Input data provided
const inputData = {input_json};
let inputLines = inputData.split('\\n');
let inputIndex = 0;

// Mock readline function
function readline() {{
    if (inputIndex < inputLines.length) {{
        return inputLines[inputIndex++];
    }}
    return null;
}}

// Mock prompt function
function prompt(message) {{
    if (inputIndex < inputLines.length) {{
        console.log(message || '');
        return inputLines[inputIndex++];
    }}
    return null;
}}

// User code starts here
{code}
"""
            code = input_code
        
        # Execute using base class implementation
        return super().execute(code, input_data)