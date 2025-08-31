"""
TypeScript code executor implementation.
"""

import re
import logging
from typing import Optional
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class TypeScriptExecutor(BaseExecutor):
    """Executor for TypeScript code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize TypeScript executor."""
        super().__init__("typescript", timeout)
    
    def get_file_extension(self) -> str:
        """Get TypeScript file extension."""
        return ".ts"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute TypeScript file."""
        return ["ts-node", file_path]
    
    def check_typescript_availability(self) -> bool:
        """
        Check if TypeScript and ts-node are available.
        
        Returns:
            True if TypeScript is available, False otherwise
        """
        try:
            # Check for ts-node
            result = __import__('subprocess').run(
                ["ts-node", "--version"],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                return True
            
            # Fallback: check for tsc (TypeScript compiler)
            result = __import__('subprocess').run(
                ["tsc", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
            
        except (FileNotFoundError, __import__('subprocess').TimeoutExpired):
            return False
    
    def get_fallback_execution_command(self, file_path: str) -> list:
        """
        Get fallback command to compile and execute TypeScript file using tsc + node.
        
        Args:
            file_path: Path to TypeScript file
            
        Returns:
            Command list for compilation
        """
        # Compile to JavaScript first, then run with node
        js_file_path = file_path.replace('.ts', '.js')
        return ["tsc", file_path, "&&", "node", js_file_path]
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse TypeScript error output to extract structured error information.
        
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
        
        # Parse TypeScript error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for TypeScript compilation errors
        if "error TS" in error_text:
            error_type = "compilation_error"
            
            # Extract line number from compilation error
            line_match = re.search(r'\((\d+),\d+\):\s*error', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'error TS\d+:\s*(.+)', error_text, re.MULTILINE)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for syntax errors
        elif "SyntaxError" in error_text:
            error_type = "syntax_error"
            
            # Extract line number from syntax error
            line_match = re.search(r':(\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            syntax_match = re.search(r'SyntaxError:\s*(.+)', error_text)
            if syntax_match:
                error_message = syntax_match.group(1).strip()
        
        # Look for runtime errors (similar to JavaScript)
        elif any(error in error_text for error in ["Error", "Exception"]):
            # Look for specific JavaScript/TypeScript runtime errors
            error_patterns = [
                (r'(ReferenceError)', "reference_error"),
                (r'(TypeError)', "type_error"),
                (r'(SyntaxError)', "syntax_error"),
                (r'(RangeError)', "range_error"),
                (r'(EvalError)', "eval_error"),
                (r'(URIError)', "uri_error"),
                (r'(\w+Error)', "error"),
            ]
            
            for pattern, error_type_name in error_patterns:
                match = re.search(pattern, error_text)
                if match:
                    error_type = error_type_name
                    break
            
            # Look for line number in stack trace
            line_match = re.search(r'at .+:(\d+):', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'(\w+Error):\s*(.+)', error_text)
            if error_match:
                error_message = error_match.group(2).strip()
            else:
                # Try to get the first line of the error
                lines = error_text.split('\n')
                for line in lines:
                    if 'Error' in line and ':' in line:
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
    
    def validate_typescript_code(self, code: str) -> Optional[str]:
        """
        Validate TypeScript code for basic security issues.
        
        Args:
            code: TypeScript code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous TypeScript/JavaScript operations
        dangerous_patterns = [
            r'\beval\s*\(',
            r'\bFunction\s*\(',
            r'\bsetTimeout\s*\(',
            r'\bsetInterval\s*\(',
            r'\brequire\s*\(',
            r'\bimport\s*\(',
            r'\bprocess\.exit\s*\(',
            r'\bprocess\.kill\s*\(',
            r'\bchild_process\.',
            r'\bfs\.',
            r'\bpath\.',
            r'\bos\.',
            r'\bcluster\.',
            r'\bworker_threads\.',
            r'\bvm\.',
            r'\brepl\.',
            r'\bdgram\.',
            r'\bnet\.',
            r'\btls\.',
            r'\bhttp\.',
            r'\bhttps\.',
            r'\burl\.',
            r'\bquerystring\.',
            r'\bzlib\.',
            r'\bcrypto\.',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous imports
        dangerous_imports = [
            r'import.*[\'"]fs[\'"]',
            r'import.*[\'"]path[\'"]',
            r'import.*[\'"]os[\'"]',
            r'import.*[\'"]child_process[\'"]',
            r'import.*[\'"]cluster[\'"]',
            r'import.*[\'"]worker_threads[\'"]',
            r'import.*[\'"]vm[\'"]',
            r'import.*[\'"]repl[\'"]',
            r'import.*[\'"]dgram[\'"]',
            r'import.*[\'"]net[\'"]',
            r'import.*[\'"]tls[\'"]',
            r'import.*[\'"]http[\'"]',
            r'import.*[\'"]https[\'"]',
            r'import.*[\'"]url[\'"]',
            r'import.*[\'"]querystring[\'"]',
            r'import.*[\'"]zlib[\'"]',
            r'import.*[\'"]crypto[\'"]',
        ]
        
        for pattern in dangerous_imports:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe import: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute TypeScript code with additional validation.
        
        Args:
            code: TypeScript code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Check if TypeScript is available
            if not self.check_typescript_availability():
                return ExecutionResult(
                    success=False,
                    error=ExecutionError(
                        type="runtime_error",
                        message="TypeScript not found. Please install TypeScript and ts-node.",
                        details="TypeScript compiler and ts-node are required to execute TypeScript code."
                    ).to_dict(),
                    execution_time=0.0
                )
            
            # Validate code for security issues
            validation_error = self.validate_typescript_code(code)
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
            logger.error(f"TypeScript executor error: {e}")
            
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