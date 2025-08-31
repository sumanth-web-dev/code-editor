"""
C code executor implementation.
"""

import re
import os
import logging
from typing import Optional, Tuple
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class CExecutor(BaseExecutor):
    """Executor for C code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize C executor."""
        super().__init__("c", timeout)
    
    def get_file_extension(self) -> str:
        """Get C file extension."""
        return ".c"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute C file (this will be overridden)."""
        # This method is overridden in execute() because C requires compilation
        return ["./program"]
    
    def wrap_code_if_needed(self, code: str) -> str:
        """
        Wrap code in a main function if it doesn't have one.
        
        Args:
            code: C source code
            
        Returns:
            Wrapped code with main function
        """
        # Check if code already has a main function
        if re.search(r'\bint\s+main\s*\(', code) or re.search(r'\bmain\s*\(', code):
            return code
        
        # Check if code has includes
        has_includes = re.search(r'#include\s*<', code)
        
        # Wrap code in a main function with necessary includes
        includes = ""
        if not has_includes:
            includes = "#include <stdio.h>\n\n"
        
        wrapped_code = f"""{includes}int main() {{
{self.indent_code(code, 4)}
    return 0;
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
    
    def check_compiler_availability(self) -> Tuple[bool, str]:
        """
        Check if C compiler is available.
        
        Returns:
            Tuple of (available, compiler_name)
        """
        compilers = ["gcc", "clang", "cl"]
        
        for compiler in compilers:
            try:
                # Try to run the compiler with version flag
                version_flags = {
                    "gcc": ["--version"],
                    "clang": ["--version"],
                    "cl": ["/help"]
                }
                
                result = __import__('subprocess').run(
                    [compiler] + version_flags.get(compiler, ["--version"]),
                    capture_output=True,
                    timeout=5
                )
                
                if result.returncode == 0 or compiler == "cl":  # cl returns non-zero for /help
                    return True, compiler
                    
            except (FileNotFoundError, __import__('subprocess').TimeoutExpired):
                continue
        
        return False, ""
    
    def compile_c(self, file_path: str) -> Tuple[bool, str, str]:
        """
        Compile C source file.
        
        Args:
            file_path: Path to C source file
            
        Returns:
            Tuple of (success, stdout, stderr)
        """
        # Check if compiler is available
        compiler_available, compiler = self.check_compiler_availability()
        if not compiler_available:
            return False, "", "C compiler not found. Please install gcc, clang, or Visual Studio Build Tools."
        
        # Get the executable path (same directory as source, named 'program')
        executable_path = os.path.join(self.temp_dir, "program")
        if os.name == 'nt':  # Windows
            executable_path += ".exe"
        
        # Build compile command based on available compiler
        if compiler == "cl":  # Microsoft Visual C++
            compile_command = [
                "cl",
                "/TC",  # Compile as C code
                "/Fe:" + executable_path,  # Output executable
                file_path
            ]
        else:  # gcc or clang
            compile_command = [
                compiler, 
                "-std=c11",    # Use C11 standard
                "-Wall",       # Enable warnings
                "-o", executable_path,
                file_path
            ]
        
        stdout, stderr, return_code, timed_out = self.execute_with_timeout(
            compile_command, cwd=self.temp_dir
        )
        
        success = return_code == 0 and not timed_out
        return success, stdout, stderr
    
    def run_c(self, input_data: str = None) -> Tuple[str, str, int, bool]:
        """
        Run compiled C executable.
        
        Args:
            input_data: Optional input data
            
        Returns:
            Tuple of (stdout, stderr, return_code, timed_out)
        """
        executable_path = os.path.join(self.temp_dir, "program")
        if os.name == 'nt':  # Windows
            executable_path += ".exe"
        
        # Make executable on Unix systems with more permissive permissions
        if os.name != 'nt' and os.path.exists(executable_path):
            try:
                # Set executable permissions for owner, group, and others
                os.chmod(executable_path, 0o755)
                # Also ensure the temp directory has proper permissions
                os.chmod(self.temp_dir, 0o755)
            except OSError as e:
                logger.warning(f"Failed to set executable permissions: {e}")
        
        run_command = [executable_path]
        
        return self.execute_with_timeout(
            run_command, input_data, cwd=self.temp_dir
        )
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse C error output to extract structured error information.
        
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
        
        # Parse C error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for compilation errors
        if "error:" in error_text.lower():
            error_type = "compilation_error"
            
            # Extract line number from compilation error
            line_match = re.search(r':(\d+):(?:\d+:)?\s*error:', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'error:\s*(.+)', error_text, re.MULTILINE)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for warnings that might be treated as errors
        elif "warning:" in error_text.lower():
            error_type = "compilation_warning"
            
            # Extract line number from warning
            line_match = re.search(r':(\d+):(?:\d+:)?\s*warning:', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract warning message
            warning_match = re.search(r'warning:\s*(.+)', error_text, re.MULTILINE)
            if warning_match:
                error_message = warning_match.group(1).strip()
        
        # Look for linker errors
        elif "undefined reference" in error_text.lower():
            error_type = "linker_error"
            error_message = "Undefined reference - missing function or library"
        
        # Look for runtime errors (segmentation fault, etc.)
        elif any(keyword in error_text.lower() for keyword in 
                ["segmentation fault", "segfault", "core dumped", "aborted"]):
            error_type = "runtime_error"
            if "segmentation fault" in error_text.lower():
                error_message = "Segmentation fault - invalid memory access"
            elif "aborted" in error_text.lower():
                error_message = "Program aborted - assertion failed or abort() called"
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_c_code(self, code: str) -> Optional[str]:
        """
        Validate C code for basic security issues.
        
        Args:
            code: C code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous C operations
        dangerous_patterns = [
            r'\bsystem\s*\(',
            r'\bexec\w*\s*\(',
            r'\bpopen\s*\(',
            r'\bfork\s*\(',
            r'\bvfork\s*\(',
            r'\bclone\s*\(',
            r'\b_exit\s*\(',
            r'\bexit\s*\(',
            r'\babort\s*\(',
            r'\batexit\s*\(',
            r'\bsignal\s*\(',
            r'\bkill\s*\(',
            r'\braise\s*\(',
            r'\bsetjmp\s*\(',
            r'\blongjmp\s*\(',
            r'\bgets\s*\(',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous includes
        dangerous_includes = [
            r'#include\s*<unistd\.h>',
            r'#include\s*<sys/',
            r'#include\s*<signal\.h>',
            r'#include\s*<setjmp\.h>',
            r'#include\s*<process\.h>',
            r'#include\s*<windows\.h>',
        ]
        
        for pattern in dangerous_includes:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe include: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute C code with compilation and additional validation.
        
        Args:
            code: C code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Validate code for security issues
            validation_error = self.validate_c_code(code)
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
            file_path = self.create_temp_file(wrapped_code, "program.c")
            
            # Compile C code
            compile_success, compile_stdout, compile_stderr = self.compile_c(file_path)
            
            if not compile_success:
                execution_time = __import__('time').time() - start_time
                error = self.parse_error_output(compile_stderr, compile_stdout)
                return ExecutionResult(
                    success=False,
                    output=compile_stdout,
                    error=error.to_dict() if error else None,
                    execution_time=execution_time
                )
            
            # Run compiled C executable
            stdout, stderr, return_code, timed_out = self.run_c(input_data)
            
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
            logger.error(f"C executor error: {e}")
            
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