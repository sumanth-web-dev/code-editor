"""
Rust code executor implementation.
"""

import re
import os
import logging
from typing import Optional, Tuple
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class RustExecutor(BaseExecutor):
    """Executor for Rust code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize Rust executor."""
        super().__init__("rust", timeout)
    
    def get_file_extension(self) -> str:
        """Get Rust file extension."""
        return ".rs"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute Rust file (this will be overridden)."""
        # This method is overridden in execute() because Rust requires compilation
        return ["./program"]
    
    def wrap_code_if_needed(self, code: str) -> str:
        """
        Wrap code in a main function if it doesn't have one.
        
        Args:
            code: Rust source code
            
        Returns:
            Wrapped code with main function
        """
        # Check if code already has a main function
        if re.search(r'\bfn\s+main\s*\(\s*\)', code):
            return code
        
        # Wrap code in a main function
        wrapped_code = f"""fn main() {{
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
    
    def check_rust_availability(self) -> bool:
        """
        Check if Rust compiler is available.
        
        Returns:
            True if Rust is available, False otherwise
        """
        try:
            # Set up environment for Rust
            env = os.environ.copy()
            env['PATH'] = '/root/.cargo/bin:' + env.get('PATH', '')
            
            result = __import__('subprocess').run(
                ["rustc", "--version"],
                capture_output=True,
                timeout=5,
                env=env
            )
            return result.returncode == 0
        except (FileNotFoundError, __import__('subprocess').TimeoutExpired):
            return False
    
    def compile_rust(self, file_path: str) -> Tuple[bool, str, str]:
        """
        Compile Rust source file.
        
        Args:
            file_path: Path to Rust source file
            
        Returns:
            Tuple of (success, stdout, stderr)
        """
        # Get the executable path (same directory as source, named 'program')
        executable_path = os.path.join(self.temp_dir, "program")
        if os.name == 'nt':  # Windows
            executable_path += ".exe"
        
        # Set up environment for Rust
        env = os.environ.copy()
        env['PATH'] = '/root/.cargo/bin:' + env.get('PATH', '')
        
        # Compile command with basic flags
        compile_command = [
            "rustc", 
            "-o", executable_path,
            file_path
        ]
        
        stdout, stderr, return_code, timed_out = self.execute_with_timeout(
            compile_command, cwd=self.temp_dir, env=env
        )
        
        success = return_code == 0 and not timed_out
        return success, stdout, stderr
    
    def run_rust(self, input_data: str = None) -> Tuple[str, str, int, bool]:
        """
        Run compiled Rust executable.
        
        Args:
            input_data: Optional input data
            
        Returns:
            Tuple of (stdout, stderr, return_code, timed_out)
        """
        executable_path = os.path.join(self.temp_dir, "program")
        if os.name == 'nt':  # Windows
            executable_path += ".exe"
        
        # Make executable on Unix systems
        if os.name != 'nt' and os.path.exists(executable_path):
            os.chmod(executable_path, 0o755)
        
        run_command = [executable_path]
        
        return self.execute_with_timeout(
            run_command, input_data, cwd=self.temp_dir
        )
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse Rust error output to extract structured error information.
        
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
        
        # Parse Rust error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for compilation errors
        if "error:" in error_text.lower():
            error_type = "compilation_error"
            
            # Extract line number from compilation error
            line_match = re.search(r'-->.*?:(\d+):', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'error(?:\[E\d+\])?\s*:\s*(.+)', error_text, re.MULTILINE)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for warnings that might be treated as errors
        elif "warning:" in error_text.lower():
            error_type = "compilation_warning"
            
            # Extract line number from warning
            line_match = re.search(r'-->.*?:(\d+):', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract warning message
            warning_match = re.search(r'warning:\s*(.+)', error_text, re.MULTILINE)
            if warning_match:
                error_message = warning_match.group(1).strip()
        
        # Look for runtime panics
        elif "panicked at" in error_text:
            error_type = "panic"
            
            # Look for line number in panic message
            line_match = re.search(r'\.rs:(\d+):', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract panic message
            panic_match = re.search(r"panicked at '([^']+)'", error_text)
            if panic_match:
                error_message = panic_match.group(1).strip()
            else:
                panic_match = re.search(r'panicked at (.+)', error_text)
                if panic_match:
                    error_message = panic_match.group(1).strip()
        
        # Look for other runtime errors
        elif any(keyword in error_text.lower() for keyword in 
                ["segmentation fault", "segfault", "core dumped", "aborted"]):
            error_type = "runtime_error"
            if "segmentation fault" in error_text.lower():
                error_message = "Segmentation fault - invalid memory access"
            elif "aborted" in error_text.lower():
                error_message = "Program aborted"
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_rust_code(self, code: str) -> Optional[str]:
        """
        Validate Rust code for basic security issues.
        
        Args:
            code: Rust code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous Rust operations
        dangerous_patterns = [
            r'\bunsafe\s*\{',
            r'\bstd::process::Command\b',
            r'\bstd::process::exit\s*\(',
            r'\bstd::process::abort\s*\(',
            r'\bstd::fs::remove_file\s*\(',
            r'\bstd::fs::remove_dir\s*\(',
            r'\bstd::fs::remove_dir_all\s*\(',
            r'\bstd::fs::rename\s*\(',
            r'\bstd::fs::copy\s*\(',
            r'\bstd::fs::create_dir\s*\(',
            r'\bstd::fs::create_dir_all\s*\(',
            r'\bstd::fs::set_permissions\s*\(',
            r'\bstd::fs::File::create\s*\(',
            r'\bstd::fs::File::open\s*\(',
            r'\bstd::fs::OpenOptions\b',
            r'\bstd::net::\w+',
            r'\bstd::thread::spawn\s*\(',
            r'\bstd::sync::\w+',
            r'\bstd::mem::transmute\s*\(',
            r'\bstd::mem::forget\s*\(',
            r'\bstd::ptr::\w+',
            r'\bstd::slice::from_raw_parts\s*\(',
            r'\bstd::str::from_utf8_unchecked\s*\(',
            r'\bstd::ffi::\w+',
            r'\blibc::\w+',
            r'\bwinapi::\w+',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous external crates
        dangerous_crates = [
            r'extern\s+crate\s+libc',
            r'extern\s+crate\s+winapi',
            r'use\s+libc::\w+',
            r'use\s+winapi::\w+',
            r'use\s+std::process::\w+',
            r'use\s+std::fs::\w+',
            r'use\s+std::net::\w+',
            r'use\s+std::thread::\w+',
            r'use\s+std::sync::\w+',
            r'use\s+std::mem::\w+',
            r'use\s+std::ptr::\w+',
            r'use\s+std::ffi::\w+',
        ]
        
        for pattern in dangerous_crates:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe import: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute Rust code with compilation and additional validation.
        
        Args:
            code: Rust code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Ensure temp_dir is available
            if self.temp_dir is None:
                import tempfile
                self.temp_dir = tempfile.mkdtemp(prefix="rust_", dir="/tmp")
            
            # Check if Rust compiler is available
            if not self.check_rust_availability():
                return ExecutionResult(
                    success=False,
                    error=ExecutionError(
                        type="runtime_error",
                        message="Rust compiler not found. Please install Rust.",
                        details="Rust compiler (rustc) is required to compile and run Rust code."
                    ).to_dict(),
                    execution_time=0.0
                )
            
            # Validate code for security issues
            validation_error = self.validate_rust_code(code)
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
            file_path = self.create_temp_file(wrapped_code, "main.rs")
            
            # Compile Rust code
            compile_success, compile_stdout, compile_stderr = self.compile_rust(file_path)
            
            if not compile_success:
                execution_time = __import__('time').time() - start_time
                error = self.parse_error_output(compile_stderr, compile_stdout)
                return ExecutionResult(
                    success=False,
                    output=compile_stdout,
                    error=error.to_dict() if error else None,
                    execution_time=execution_time
                )
            
            # Run compiled Rust executable
            stdout, stderr, return_code, timed_out = self.run_rust(input_data)
            
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
            logger.error(f"Rust executor error: {e}")
            
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