"""
Java code executor implementation.
"""

import re
import os
import logging
from typing import Optional, Tuple
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class JavaExecutor(BaseExecutor):
    """Executor for Java code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize Java executor."""
        super().__init__("java", timeout)
    
    def get_file_extension(self) -> str:
        """Get Java file extension."""
        return ".java"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute Java file (this will be overridden)."""
        # This method is overridden in execute() because Java requires compilation
        return ["java", file_path]
    
    def extract_class_name(self, code: str) -> str:
        """
        Extract the main class name from Java code.
        
        Args:
            code: Java source code
            
        Returns:
            Class name or 'Main' as default
        """
        # Look for public class declaration
        public_class_match = re.search(r'public\s+class\s+(\w+)', code)
        if public_class_match:
            return public_class_match.group(1)
        
        # Look for any class declaration
        class_match = re.search(r'class\s+(\w+)', code)
        if class_match:
            return class_match.group(1)
        
        # Default class name
        return "Main"
    
    def wrap_code_if_needed(self, code: str) -> Tuple[str, str]:
        """
        Wrap code in a main class if it doesn't have one.
        
        Args:
            code: Java source code
            
        Returns:
            Tuple of (wrapped_code, class_name)
        """
        # Check if code already has a class definition
        if re.search(r'\bclass\s+\w+', code):
            class_name = self.extract_class_name(code)
            return code, class_name
        
        # Wrap code in a Main class
        class_name = "Main"
        wrapped_code = f"""
public class {class_name} {{
    public static void main(String[] args) {{
{self.indent_code(code, 8)}
    }}
}}
"""
        return wrapped_code, class_name
    
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
    
    def compile_java(self, file_path: str, class_name: str) -> Tuple[bool, str, str]:
        """
        Compile Java source file.
        
        Args:
            file_path: Path to Java source file
            class_name: Name of the main class
            
        Returns:
            Tuple of (success, stdout, stderr)
        """
        compile_command = ["javac", file_path]
        
        stdout, stderr, return_code, timed_out = self.execute_with_timeout(
            compile_command, cwd=self.temp_dir
        )
        
        success = return_code == 0 and not timed_out
        return success, stdout, stderr
    
    def run_java(self, class_name: str, input_data: str = None) -> Tuple[str, str, int, bool]:
        """
        Run compiled Java class.
        
        Args:
            class_name: Name of the main class to run
            input_data: Optional input data
            
        Returns:
            Tuple of (stdout, stderr, return_code, timed_out)
        """
        run_command = ["java", class_name]
        
        return self.execute_with_timeout(
            run_command, input_data, cwd=self.temp_dir
        )
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse Java error output to extract structured error information.
        
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
        
        # Parse Java error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for compilation errors
        if "error:" in error_text.lower():
            error_type = "compilation_error"
            
            # Extract line number from compilation error
            line_match = re.search(r':(\d+):\s*error:', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'error:\s*(.+)', error_text, re.MULTILINE)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for runtime exceptions
        elif "Exception" in error_text:
            # Look for specific Java exceptions
            exception_patterns = [
                (r'(NullPointerException)', "null_pointer_exception"),
                (r'(ArrayIndexOutOfBoundsException)', "array_index_out_of_bounds_exception"),
                (r'(StringIndexOutOfBoundsException)', "string_index_out_of_bounds_exception"),
                (r'(NumberFormatException)', "number_format_exception"),
                (r'(IllegalArgumentException)', "illegal_argument_exception"),
                (r'(ClassCastException)', "class_cast_exception"),
                (r'(ArithmeticException)', "arithmetic_exception"),
                (r'(IOException)', "io_exception"),
                (r'(FileNotFoundException)', "file_not_found_exception"),
                (r'(SecurityException)', "security_exception"),
                (r'(\w+Exception)', "exception"),
            ]
            
            for pattern, exception_type in exception_patterns:
                match = re.search(pattern, error_text)
                if match:
                    error_type = exception_type
                    break
            
            # Look for line number in stack trace
            line_match = re.search(r'at .+\.java:(\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract exception message
            exception_match = re.search(r'Exception(?:\s*in\s*thread\s*"[^"]*")?\s*:\s*(.+)', error_text)
            if exception_match:
                error_message = exception_match.group(1).strip()
            else:
                # Try to get the first line of the exception
                lines = error_text.split('\n')
                for line in lines:
                    if 'Exception' in line:
                        error_message = line.strip()
                        break
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_java_code(self, code: str) -> Optional[str]:
        """
        Validate Java code for basic security issues.
        
        Args:
            code: Java code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous Java operations
        dangerous_patterns = [
            r'\bRuntime\.getRuntime\(\)',
            r'\bProcessBuilder\b',
            r'\bProcess\b',
            r'\bSystem\.exit\s*\(',
            r'\bSystem\.getProperty\s*\(',
            r'\bSystem\.setProperty\s*\(',
            r'\bSystem\.getenv\s*\(',
            r'\bFile\s*\(',
            r'\bFileInputStream\b',
            r'\bFileOutputStream\b',
            r'\bFileReader\b',
            r'\bFileWriter\b',
            r'\bRandomAccessFile\b',
            r'\bSocket\b',
            r'\bServerSocket\b',
            r'\bURL\b',
            r'\bURLConnection\b',
            r'\bHttpURLConnection\b',
            r'\bClassLoader\b',
            r'\bClass\.forName\s*\(',
            r'\bMethod\.invoke\s*\(',
            r'\bReflection\b',
            r'\bjava\.lang\.reflect\b',
            r'\bjava\.io\.File\b',
            r'\bjava\.net\.',
            r'\bjava\.security\.',
            r'\bjavax\.script\b',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous imports
        dangerous_imports = [
            r'\bimport\s+java\.io\.',
            r'\bimport\s+java\.net\.',
            r'\bimport\s+java\.security\.',
            r'\bimport\s+java\.lang\.reflect\.',
            r'\bimport\s+javax\.script\.',
        ]
        
        for pattern in dangerous_imports:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe import: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute Java code with compilation and additional validation.
        
        Args:
            code: Java code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Validate code for security issues
            validation_error = self.validate_java_code(code)
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
            
            # Wrap code if needed and get class name
            wrapped_code, class_name = self.wrap_code_if_needed(code)
            
            # Create temporary file with wrapped code
            file_path = self.create_temp_file(wrapped_code, f"{class_name}.java")
            
            # Compile Java code
            compile_success, compile_stdout, compile_stderr = self.compile_java(file_path, class_name)
            
            if not compile_success:
                execution_time = __import__('time').time() - start_time
                error = self.parse_error_output(compile_stderr, compile_stdout)
                return ExecutionResult(
                    success=False,
                    output=compile_stdout,
                    error=error.to_dict() if error else None,
                    execution_time=execution_time
                )
            
            # Run compiled Java class
            stdout, stderr, return_code, timed_out = self.run_java(class_name, input_data)
            
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
            logger.error(f"Java executor error: {e}")
            
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