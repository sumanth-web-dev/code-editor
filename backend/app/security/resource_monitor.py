"""
Resource monitoring and limits for code execution.
"""

import os
import time
import psutil
import signal
import logging
import threading
from typing import Dict, Optional, Callable, Any
from dataclasses import dataclass
from contextlib import contextmanager

logger = logging.getLogger(__name__)

@dataclass
class ResourceLimits:
    """Resource limits for code execution."""
    max_memory_mb: int = 128  # Maximum memory in MB
    max_cpu_percent: float = 80.0  # Maximum CPU usage percentage
    max_execution_time: int = 30  # Maximum execution time in seconds
    max_file_size_mb: int = 10  # Maximum file size in MB
    max_open_files: int = 100  # Maximum number of open files
    max_processes: int = 5  # Maximum number of processes

@dataclass
class ResourceUsage:
    """Current resource usage statistics."""
    memory_mb: float = 0.0
    cpu_percent: float = 0.0
    execution_time: float = 0.0
    open_files: int = 0
    processes: int = 0
    peak_memory_mb: float = 0.0

class ResourceMonitor:
    """Monitor and enforce resource limits during code execution."""
    
    def __init__(self, limits: Optional[ResourceLimits] = None):
        """
        Initialize resource monitor.
        
        Args:
            limits: Resource limits to enforce
        """
        self.limits = limits or ResourceLimits()
        self.monitoring = False
        self.start_time = 0.0
        self.process = None
        self.usage = ResourceUsage()
        self.violation_callback: Optional[Callable] = None
        self._monitor_thread = None
        self._stop_monitoring = threading.Event()
    
    def set_violation_callback(self, callback: Callable[[str, Any], None]):
        """
        Set callback function to be called when resource limits are violated.
        
        Args:
            callback: Function to call with (violation_type, details)
        """
        self.violation_callback = callback
    
    @contextmanager
    def monitor_execution(self, process: psutil.Process):
        """
        Context manager to monitor resource usage during execution.
        
        Args:
            process: Process to monitor
        """
        self.process = process
        self.start_time = time.time()
        self.monitoring = True
        self.usage = ResourceUsage()
        self._stop_monitoring.clear()
        
        # Start monitoring thread
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
        
        try:
            yield self
        finally:
            self.monitoring = False
            self._stop_monitoring.set()
            
            # Wait for monitor thread to finish
            if self._monitor_thread and self._monitor_thread.is_alive():
                self._monitor_thread.join(timeout=1.0)
    
    def _monitor_loop(self):
        """Main monitoring loop running in separate thread."""
        while self.monitoring and not self._stop_monitoring.is_set():
            try:
                if self.process and self.process.is_running():
                    self._check_resources()
                    time.sleep(0.1)  # Check every 100ms
                else:
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break
            except Exception as e:
                logger.error(f"Error in resource monitoring: {e}")
                break
    
    def _check_resources(self):
        """Check current resource usage against limits."""
        try:
            # Update execution time
            self.usage.execution_time = time.time() - self.start_time
            
            # Check execution time limit
            if self.usage.execution_time > self.limits.max_execution_time:
                self._handle_violation("execution_time", {
                    'current': self.usage.execution_time,
                    'limit': self.limits.max_execution_time
                })
                return
            
            # Get process info
            memory_info = self.process.memory_info()
            self.usage.memory_mb = memory_info.rss / (1024 * 1024)  # Convert to MB
            self.usage.peak_memory_mb = max(self.usage.peak_memory_mb, self.usage.memory_mb)
            
            # Check memory limit
            if self.usage.memory_mb > self.limits.max_memory_mb:
                self._handle_violation("memory", {
                    'current_mb': self.usage.memory_mb,
                    'limit_mb': self.limits.max_memory_mb
                })
                return
            
            # Get CPU usage (averaged over short interval)
            self.usage.cpu_percent = self.process.cpu_percent()
            
            # Check CPU limit (only after some time to get accurate reading)
            if self.usage.execution_time > 1.0 and self.usage.cpu_percent > self.limits.max_cpu_percent:
                self._handle_violation("cpu", {
                    'current_percent': self.usage.cpu_percent,
                    'limit_percent': self.limits.max_cpu_percent
                })
                return
            
            # Count open files
            try:
                open_files = self.process.open_files()
                self.usage.open_files = len(open_files)
                
                if self.usage.open_files > self.limits.max_open_files:
                    self._handle_violation("open_files", {
                        'current': self.usage.open_files,
                        'limit': self.limits.max_open_files
                    })
                    return
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                pass  # Can't access file info, skip this check
            
            # Count child processes
            try:
                children = self.process.children(recursive=True)
                self.usage.processes = len(children) + 1  # +1 for main process
                
                if self.usage.processes > self.limits.max_processes:
                    self._handle_violation("processes", {
                        'current': self.usage.processes,
                        'limit': self.limits.max_processes
                    })
                    return
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                pass  # Can't access process info, skip this check
            
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            # Process ended or access denied, stop monitoring
            self.monitoring = False
        except Exception as e:
            logger.error(f"Error checking resources: {e}")
    
    def _handle_violation(self, violation_type: str, details: Dict[str, Any]):
        """
        Handle resource limit violation.
        
        Args:
            violation_type: Type of violation
            details: Violation details
        """
        logger.warning(f"Resource limit violation: {violation_type} - {details}")
        
        # Call violation callback if set
        if self.violation_callback:
            try:
                self.violation_callback(violation_type, details)
            except Exception as e:
                logger.error(f"Error in violation callback: {e}")
        
        # Terminate the process
        self._terminate_process()
        
        # Stop monitoring
        self.monitoring = False
    
    def _terminate_process(self):
        """Terminate the monitored process and its children."""
        if not self.process:
            return
        
        try:
            # Get all child processes first
            children = self.process.children(recursive=True)
            
            # Terminate children first
            for child in children:
                try:
                    child.terminate()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            # Terminate main process
            self.process.terminate()
            
            # Wait a bit for graceful termination
            time.sleep(0.5)
            
            # Force kill if still running
            if self.process.is_running():
                for child in children:
                    try:
                        if child.is_running():
                            child.kill()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                
                if self.process.is_running():
                    self.process.kill()
            
            logger.info("Process terminated due to resource limit violation")
            
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            logger.warning(f"Could not terminate process: {e}")
        except Exception as e:
            logger.error(f"Error terminating process: {e}")
    
    def get_current_usage(self) -> ResourceUsage:
        """
        Get current resource usage.
        
        Returns:
            Current resource usage statistics
        """
        return self.usage
    
    def is_within_limits(self) -> bool:
        """
        Check if current usage is within limits.
        
        Returns:
            True if within limits, False otherwise
        """
        return (
            self.usage.memory_mb <= self.limits.max_memory_mb and
            self.usage.cpu_percent <= self.limits.max_cpu_percent and
            self.usage.execution_time <= self.limits.max_execution_time and
            self.usage.open_files <= self.limits.max_open_files and
            self.usage.processes <= self.limits.max_processes
        )

class ExecutionTimeoutHandler:
    """Handle execution timeouts using signals (Unix-like systems)."""
    
    def __init__(self, timeout_seconds: int):
        """
        Initialize timeout handler.
        
        Args:
            timeout_seconds: Timeout in seconds
        """
        self.timeout_seconds = timeout_seconds
        self.old_handler = None
    
    def __enter__(self):
        """Set up timeout handler."""
        if os.name != 'nt':  # Unix-like systems
            self.old_handler = signal.signal(signal.SIGALRM, self._timeout_handler)
            signal.alarm(self.timeout_seconds)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Clean up timeout handler."""
        if os.name != 'nt':  # Unix-like systems
            signal.alarm(0)  # Cancel alarm
            if self.old_handler:
                signal.signal(signal.SIGALRM, self.old_handler)
    
    def _timeout_handler(self, signum, frame):
        """Handle timeout signal."""
        raise TimeoutError(f"Execution timed out after {self.timeout_seconds} seconds")

def create_resource_limits(language: str) -> ResourceLimits:
    """
    Create appropriate resource limits for a programming language.
    
    Args:
        language: Programming language
        
    Returns:
        Resource limits for the language
    """
    # Base limits
    limits = ResourceLimits()
    
    # Language-specific adjustments
    if language == 'java':
        # Java needs more memory for JVM
        limits.max_memory_mb = 256
        limits.max_execution_time = 45  # Compilation + execution
    elif language == 'cpp':
        # C++ needs time for compilation
        limits.max_memory_mb = 128
        limits.max_execution_time = 45
    elif language == 'csharp':
        # C# needs more resources
        limits.max_memory_mb = 256
        limits.max_execution_time = 45
    elif language == 'rust':
        # Rust compilation can be slow
        limits.max_memory_mb = 256
        limits.max_execution_time = 60
    elif language == 'go':
        # Go is generally efficient
        limits.max_memory_mb = 128
        limits.max_execution_time = 30
    elif language in ['python', 'javascript', 'php', 'ruby']:
        # Interpreted languages
        limits.max_memory_mb = 128
        limits.max_execution_time = 30
    elif language == 'typescript':
        # TypeScript needs compilation
        limits.max_memory_mb = 256
        limits.max_execution_time = 45
    
    return limits