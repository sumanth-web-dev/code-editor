"""
Code execution service foundation.
"""

import time
import logging
import threading
from typing import Dict, Any, Optional
from app.models.execution import ExecutionRequest, ExecutionResult, create_error_result
from app.models.language import get_language_by_id
from app.security.resource_monitor import ResourceMonitor, create_resource_limits

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ExecutionService:
    """Service for executing code in various programming languages."""
    
    def __init__(self):
        """Initialize the execution service."""
        self.executors = {}
        self.execution_lock = threading.Lock()
        self._load_language_executors()
    
    def _load_language_executors(self):
        """Load language-specific executors."""
        try:
            # Import available executors
            from app.executors.python_executor import PythonExecutor
            from app.executors.javascript_executor import JavaScriptExecutor
            from app.executors.java_executor import JavaExecutor
            from app.executors.cpp_executor import CppExecutor
            from app.executors.c_executor import CExecutor
            from app.executors.csharp_executor import CSharpExecutor
            from app.executors.php_executor import PhpExecutor
            from app.executors.ruby_executor import RubyExecutor
            from app.executors.go_executor import GoExecutor
            from app.executors.rust_executor import RustExecutor
            from app.executors.r_executor import RExecutor
            from app.executors.typescript_executor import TypeScriptExecutor
            
            # Initialize executors
            self.executors['python'] = PythonExecutor
            self.executors['javascript'] = JavaScriptExecutor
            self.executors['java'] = JavaExecutor
            self.executors['cpp'] = CppExecutor
            self.executors['c'] = CExecutor
            self.executors['csharp'] = CSharpExecutor
            self.executors['php'] = PhpExecutor
            self.executors['ruby'] = RubyExecutor
            self.executors['go'] = GoExecutor
            self.executors['rust'] = RustExecutor
            self.executors['r'] = RExecutor
            self.executors['typescript'] = TypeScriptExecutor
            
            logger.info(f"Loaded executors for languages: {list(self.executors.keys())}")
            
        except ImportError as e:
            logger.error(f"Failed to import executor: {e}")
        except Exception as e:
            logger.error(f"Error loading executors: {e}")
    
    def execute_code(self, request: ExecutionRequest) -> ExecutionResult:
        """
        Execute code based on the execution request.
        
        Args:
            request: ExecutionRequest containing code and language info
            
        Returns:
            ExecutionResult with execution output or error
        """
        start_time = time.time()
        
        try:
            # Validate the request
            validation = request.validate()
            if not validation['valid']:
                return create_error_result(
                    'validation_error',
                    'Invalid execution request',
                    '; '.join(validation['errors'])
                )
            
            # Sanitize the request
            sanitized_request = request.sanitize()
            
            # Check if language is supported
            language = get_language_by_id(sanitized_request.language)
            if not language:
                return create_error_result(
                    'unsupported_language',
                    f'Language "{sanitized_request.language}" is not supported'
                )
            
            # Check if executor is available for this language
            if sanitized_request.language not in self.executors:
                logger.warning(f"No executor available for language: {sanitized_request.language}")
                return create_error_result(
                    'executor_not_available',
                    f'Code execution not yet implemented for {language.name}',
                    f'Executor for {sanitized_request.language} is not available'
                )
            
            # Log execution attempt
            logger.info(f"Executing {language.name} code (length: {len(sanitized_request.code)} chars)")
            
            # Use thread lock to prevent concurrent executions from interfering
            with self.execution_lock:
                # Get executor class and create instance
                executor_class = self.executors[sanitized_request.language]
                timeout = sanitized_request.timeout or language.timeout_seconds
                executor = executor_class(timeout=timeout)
                
                try:
                    # Execute the code
                    result = executor.execute(
                        sanitized_request.code,
                        sanitized_request.input
                    )
                    
                    # Log execution result
                    execution_time = time.time() - start_time
                    if result.success:
                        logger.info(f"Code execution successful for {language.name}: time={execution_time:.3f}s")
                    else:
                        logger.warning(f"Code execution failed for {language.name}: {result.error}")
                    
                    return result
                    
                except Exception as e:
                    logger.error(f"Executor error for {language.name}: {str(e)}")
                    execution_time = time.time() - start_time
                    
                    return ExecutionResult(
                        success=False,
                        error={
                            'type': 'executor_error',
                            'message': f'Error executing {language.name} code',
                            'details': str(e)
                        },
                        execution_time=execution_time
                    )
            
        except Exception as e:
            logger.error(f"Execution service error: {str(e)}")
            execution_time = time.time() - start_time
            
            return ExecutionResult(
                success=False,
                error={
                    'type': 'service_error',
                    'message': 'Internal execution service error',
                    'details': str(e)
                },
                execution_time=execution_time
            )
    
    def get_supported_languages(self) -> list:
        """
        Get list of supported languages for execution.
        
        Returns:
            List of supported language IDs
        """
        from app.models.language import get_all_languages
        return [lang.id for lang in get_all_languages()]
    
    def get_available_executors(self) -> list:
        """
        Get list of languages with available executors.
        
        Returns:
            List of language IDs with working executors
        """
        return list(self.executors.keys())
    
    def is_language_supported(self, language_id: str) -> bool:
        """
        Check if a language is supported for execution.
        
        Args:
            language_id: Language identifier
            
        Returns:
            True if language is supported, False otherwise
        """
        return language_id in self.get_supported_languages()
    
    def is_executor_available(self, language_id: str) -> bool:
        """
        Check if an executor is available for a language.
        
        Args:
            language_id: Language identifier
            
        Returns:
            True if executor is available, False otherwise
        """
        return language_id in self.executors

# Global execution service instance
execution_service = ExecutionService()