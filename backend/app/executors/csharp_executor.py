"""
C# code executor implementation.
"""

import re
import os
import logging
from typing import Optional, Tuple
from .base_executor import BaseExecutor
from app.models.execution import ExecutionError, ExecutionResult

logger = logging.getLogger(__name__)

class CSharpExecutor(BaseExecutor):
    """Executor for C# code."""
    
    def __init__(self, timeout: int = 30):
        """Initialize C# executor."""
        super().__init__("csharp", timeout)
    
    def get_file_extension(self) -> str:
        """Get C# file extension."""
        return ".cs"
    
    def get_execution_command(self, file_path: str) -> list:
        """Get command to execute C# file (this will be overridden)."""
        # This method is overridden in execute() because C# requires compilation
        return ["dotnet", "run"]
    
    def wrap_code_if_needed(self, code: str) -> str:
        """
        Wrap code in a Main method if it doesn't have one.
        
        Args:
            code: C# source code
            
        Returns:
            Wrapped code with Main method
        """
        # Check if code already has a Main method
        if re.search(r'\bstatic\s+void\s+Main\s*\(', code, re.IGNORECASE):
            return code
        
        # Check if code has using statements
        has_usings = re.search(r'using\s+\w+', code)
        
        # Wrap code in a Main method with necessary usings
        usings = ""
        if not has_usings:
            usings = "using System;\n\n"
        
        wrapped_code = f"""{usings}class Program
{{
    static void Main(string[] args)
    {{
{self.indent_code(code, 8)}
    }}
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
    
    def check_dotnet_availability(self) -> bool:
        """
        Check if .NET CLI is available.
        
        Returns:
            True if dotnet is available, False otherwise
        """
        try:
            result = __import__('subprocess').run(
                ["dotnet", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, __import__('subprocess').TimeoutExpired):
            return False
    
    def create_project_files(self, code: str) -> str:
        """
        Create a .NET project with the C# code.
        
        Args:
            code: C# source code
            
        Returns:
            Path to the main C# file
        """
        # Create project file
        project_content = '''<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>'''
        
        project_path = os.path.join(self.temp_dir, "Program.csproj")
        with open(project_path, 'w', encoding='utf-8') as f:
            f.write(project_content)
        
        # Create main C# file
        cs_file_path = os.path.join(self.temp_dir, "Program.cs")
        with open(cs_file_path, 'w', encoding='utf-8') as f:
            f.write(code)
        
        return cs_file_path
    
    def compile_and_run_csharp(self, input_data: str = None, env: dict = None) -> Tuple[str, str, int, bool]:
        """
        Compile and run C# project.
        
        Args:
            input_data: Optional input data
            env: Environment variables
            
        Returns:
            Tuple of (stdout, stderr, return_code, timed_out)
        """
        # Use dotnet run to compile and execute
        run_command = ["dotnet", "run"]
        
        return self.execute_with_timeout(
            run_command, input_data, cwd=self.temp_dir, env=env
        )
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse C# error output to extract structured error information.
        
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
        
        # Parse C# error information
        line_number = None
        error_type = "runtime_error"
        error_message = error_text
        
        # Look for compilation errors
        if "error CS" in error_text:
            error_type = "compilation_error"
            
            # Extract line number from compilation error
            line_match = re.search(r'\((\d+),\d+\):\s*error', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract error message
            error_match = re.search(r'error CS\d+:\s*(.+)', error_text, re.MULTILINE)
            if error_match:
                error_message = error_match.group(1).strip()
        
        # Look for runtime exceptions
        elif "Exception" in error_text:
            # Look for specific C# exceptions
            exception_patterns = [
                (r'(NullReferenceException)', "null_reference_exception"),
                (r'(ArgumentException)', "argument_exception"),
                (r'(ArgumentNullException)', "argument_null_exception"),
                (r'(IndexOutOfRangeException)', "index_out_of_range_exception"),
                (r'(InvalidOperationException)', "invalid_operation_exception"),
                (r'(FormatException)', "format_exception"),
                (r'(OverflowException)', "overflow_exception"),
                (r'(DivideByZeroException)', "divide_by_zero_exception"),
                (r'(FileNotFoundException)', "file_not_found_exception"),
                (r'(DirectoryNotFoundException)', "directory_not_found_exception"),
                (r'(UnauthorizedAccessException)', "unauthorized_access_exception"),
                (r'(\w+Exception)', "exception"),
            ]
            
            for pattern, exception_type in exception_patterns:
                match = re.search(pattern, error_text)
                if match:
                    error_type = exception_type
                    break
            
            # Look for line number in stack trace
            line_match = re.search(r'at .+\.cs:line (\d+)', error_text)
            if line_match:
                line_number = int(line_match.group(1))
            
            # Extract exception message
            exception_match = re.search(r'Exception:\s*(.+)', error_text)
            if exception_match:
                error_message = exception_match.group(1).strip()
            else:
                # Try to get the first line of the exception
                lines = error_text.split('\n')
                for line in lines:
                    if 'Exception' in line and ':' in line:
                        error_message = line.split(':', 1)[1].strip()
                        break
        
        return ExecutionError(
            type=error_type,
            message=error_message,
            line=line_number,
            details=error_text
        )
    
    def validate_csharp_code(self, code: str) -> Optional[str]:
        """
        Validate C# code for basic security issues.
        
        Args:
            code: C# code to validate
            
        Returns:
            Error message if validation fails, None if valid
        """
        # Check for potentially dangerous C# operations
        dangerous_patterns = [
            r'\bProcess\.Start\s*\(',
            r'\bProcessStartInfo\b',
            r'\bSystem\.Diagnostics\.Process\b',
            r'\bEnvironment\.Exit\s*\(',
            r'\bApplication\.Exit\s*\(',
            r'\bSystem\.Environment\.Exit\s*\(',
            r'\bFile\.Delete\s*\(',
            r'\bDirectory\.Delete\s*\(',
            r'\bFile\.Move\s*\(',
            r'\bFile\.Copy\s*\(',
            r'\bRegistry\.',
            r'\bMicrosoft\.Win32\.Registry\b',
            r'\bSystem\.Runtime\.InteropServices\b',
            r'\bDllImport\b',
            r'\bMarshal\.',
            r'\bGCHandle\b',
            r'\bUnsafe\b',
            r'\bfixed\s*\(',
            r'\bstackalloc\b',
            r'\bSystem\.Reflection\.',
            r'\bAssembly\.Load\s*\(',
            r'\bActivator\.CreateInstance\s*\(',
            r'\bType\.GetType\s*\(',
            r'\bMethodInfo\.Invoke\s*\(',
        ]
        
        for pattern in dangerous_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe operation: {pattern}"
        
        # Check for dangerous using statements
        dangerous_usings = [
            r'using\s+System\.Diagnostics',
            r'using\s+System\.IO',
            r'using\s+System\.Runtime\.InteropServices',
            r'using\s+Microsoft\.Win32',
            r'using\s+System\.Reflection',
        ]
        
        for pattern in dangerous_usings:
            if re.search(pattern, code, re.IGNORECASE):
                return f"Code contains potentially unsafe using statement: {pattern}"
        
        return None
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute C# code with compilation and additional validation.
        
        Args:
            code: C# code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = __import__('time').time()
        
        try:
            # Check if .NET CLI is available
            if not self.check_dotnet_availability():
                return ExecutionResult(
                    success=False,
                    error=ExecutionError(
                        type="runtime_error",
                        message=".NET CLI not found. Please install .NET 6.0 or later.",
                        details=".NET CLI (dotnet) is required to compile and run C# code."
                    ).to_dict(),
                    execution_time=0.0
                )
            
            # Set .NET environment variables
            import os
            env = os.environ.copy()
            
            # Ensure temp_dir is available
            if self.temp_dir is None:
                import tempfile
                self.temp_dir = tempfile.mkdtemp(prefix="csharp_", dir="/tmp")
            
            # Ensure .NET directories exist and are writable
            dotnet_home = '/home/appuser/.dotnet'
            nuget_packages = '/home/appuser/.nuget/packages'
            
            try:
                os.makedirs(dotnet_home, exist_ok=True)
                os.makedirs(nuget_packages, exist_ok=True)
                os.chmod(dotnet_home, 0o755)
                os.chmod(nuget_packages, 0o755)
            except (OSError, PermissionError):
                # Fallback to temp directory
                dotnet_home = os.path.join(self.temp_dir, 'dotnet')
                nuget_packages = os.path.join(self.temp_dir, 'nuget')
                os.makedirs(dotnet_home, exist_ok=True)
                os.makedirs(nuget_packages, exist_ok=True)
            
            env['DOTNET_CLI_HOME'] = dotnet_home
            env['DOTNET_SKIP_FIRST_TIME_EXPERIENCE'] = '1'
            env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'
            env['NUGET_PACKAGES'] = nuget_packages
            env['DOTNET_ROOT'] = '/usr/share/dotnet'
            env['PATH'] = '/usr/local/bin:/usr/share/dotnet:' + env.get('PATH', '')
            
            # Validate code for security issues
            validation_error = self.validate_csharp_code(code)
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
            
            # Create project files
            self.create_project_files(wrapped_code)
            
            # Compile and run C# code
            stdout, stderr, return_code, timed_out = self.compile_and_run_csharp(input_data, env)
            
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
            logger.error(f"C# executor error: {e}")
            
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