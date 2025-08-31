"""
Base executor class for code execution.
"""

import os
import tempfile
import subprocess
import time
import signal
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
from app.models.execution import ExecutionResult, ExecutionError

logger = logging.getLogger(__name__)

class BaseExecutor(ABC):
    """Base class for language-specific code executors."""
    
    def __init__(self, language_id: str, timeout: int = 30):
        """
        Initialize the base executor.
        
        Args:
            language_id: Language identifier
            timeout: Maximum execution time in seconds
        """
        self.language_id = language_id
        self.timeout = timeout
        self.temp_dir = None
        self.temp_files = []
    
    @abstractmethod
    def get_file_extension(self) -> str:
        """Get the file extension for this language."""
        pass
    
    @abstractmethod
    def get_execution_command(self, file_path: str) -> list:
        """Get the command to execute the code file."""
        pass
    
    def create_temp_file(self, code: str, filename: str = None) -> str:
        """
        Create a temporary file with the code.
        
        Args:
            code: Code content
            filename: Optional filename (will generate if not provided)
            
        Returns:
            Path to the temporary file
        """
        if self.temp_dir is None:
            # Try to create temp directory in /tmp first (which should be writable in container)
            try:
                self.temp_dir = tempfile.mkdtemp(prefix=f"{self.language_id}_", dir="/tmp")
                # Ensure the directory is writable
                os.chmod(self.temp_dir, 0o755)
            except (OSError, PermissionError):
                # Fallback to default temp directory
                try:
                    self.temp_dir = tempfile.mkdtemp(prefix=f"{self.language_id}_")
                    os.chmod(self.temp_dir, 0o755)
                except (OSError, PermissionError):
                    # Last resort: use current working directory
                    import uuid
                    self.temp_dir = os.path.join(os.getcwd(), f"temp_{self.language_id}_{uuid.uuid4().hex[:8]}")
                    os.makedirs(self.temp_dir, exist_ok=True)
                    os.chmod(self.temp_dir, 0o755)
        
        if filename is None:
            filename = f"code{self.get_file_extension()}"
        
        file_path = os.path.join(self.temp_dir, filename)
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            # Make file readable and executable
            os.chmod(file_path, 0o644)
        except (OSError, PermissionError) as e:
            logger.error(f"Failed to create temp file {file_path}: {e}")
            raise
        
        self.temp_files.append(file_path)
        return file_path
    
    def cleanup_temp_files(self):
        """Clean up temporary files and directories."""
        import shutil
        
        for file_path in self.temp_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to remove temp file {file_path}: {e}")
        
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
            except Exception as e:
                logger.warning(f"Failed to remove temp directory {self.temp_dir}: {e}")
        
        self.temp_files = []
        self.temp_dir = None
    
    def execute_with_timeout(self, command: list, input_data: str = None, 
                           cwd: str = None, env: dict = None) -> Tuple[str, str, int, bool]:
        """
        Execute a command with timeout and resource limits.
        
        Args:
            command: Command to execute
            input_data: Input data to send to the process
            cwd: Working directory
            env: Environment variables (optional)
            
        Returns:
            Tuple of (stdout, stderr, return_code, timed_out)
        """
        try:
            # Set environment variables for proper Unicode handling
            if env is None:
                env = os.environ.copy()
            env['PYTHONIOENCODING'] = 'utf-8'
            
            # Ensure cwd is set to a valid directory
            if cwd is None:
                cwd = self.temp_dir or '/tmp'
            
            # Start the process
            process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                cwd=cwd,
                env=env,
                preexec_fn=os.setsid if os.name != 'nt' else None  # Process group for Unix
            )
            
            start_time = time.time()
            stdout = ""
            stderr = ""
            timed_out = False
            
            try:
                # Communicate with timeout
                stdout, stderr = process.communicate(
                    input=input_data, 
                    timeout=self.timeout
                )
            except subprocess.TimeoutExpired:
                timed_out = True
                # Kill the process group to ensure all child processes are terminated
                try:
                    if os.name != 'nt':
                        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                    else:
                        process.terminate()
                    
                    # Wait a bit for graceful termination
                    try:
                        process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        # Force kill if still running
                        if os.name != 'nt':
                            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                        else:
                            process.kill()
                        process.wait()
                        
                except (ProcessLookupError, OSError) as e:
                    logger.warning(f"Error terminating process: {e}")
                
                stdout, stderr = process.communicate()
                stderr += f"\nExecution timed out after {self.timeout} seconds"
            
            return stdout, stderr, process.returncode, timed_out
            
        except Exception as e:
            logger.error(f"Error executing command {command}: {e}")
            return "", f"Execution error: {str(e)}", 1, False
    
    def parse_error_output(self, stderr: str, stdout: str = "") -> Optional[ExecutionError]:
        """
        Parse error output to extract structured error information.
        
        Args:
            stderr: Standard error output
            stdout: Standard output (may contain errors)
            
        Returns:
            ExecutionError object or None if no error
        """
        if not stderr.strip() and not stdout.strip():
            return None
        
        # Combine stderr and stdout for error analysis
        error_text = stderr + stdout
        
        # Default error parsing - subclasses can override for language-specific parsing
        return ExecutionError(
            type="runtime_error",
            message=stderr.strip() if stderr.strip() else stdout.strip(),
            details=error_text.strip()
        )
    
    def execute(self, code: str, input_data: str = None) -> ExecutionResult:
        """
        Execute code and return the result.
        
        Args:
            code: Code to execute
            input_data: Optional input data
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = time.time()
        
        try:
            # Create temporary file with code
            file_path = self.create_temp_file(code)
            
            # Ensure temp_dir is set
            if self.temp_dir is None:
                self.temp_dir = os.path.dirname(file_path)
            
            # Get execution command
            command = self.get_execution_command(file_path)
            
            # Execute the command
            stdout, stderr, return_code, timed_out = self.execute_with_timeout(
                command, input_data, cwd=self.temp_dir
            )
            
            execution_time = time.time() - start_time
            
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
            execution_time = time.time() - start_time
            logger.error(f"Executor error for {self.language_id}: {e}")
            
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