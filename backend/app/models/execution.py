"""
Code execution request and response models.
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
import re
import html

@dataclass
class ExecutionRequest:
    """Model for code execution requests."""
    language: str
    code: str
    input: Optional[str] = None
    timeout: Optional[int] = None
    
    def validate(self) -> Dict[str, Any]:
        """
        Validate the execution request.
        
        Returns:
            Dict with 'valid' boolean and 'errors' list
        """
        errors = []
        
        # Validate language
        if not self.language or not isinstance(self.language, str):
            errors.append("Language is required and must be a string")
        elif not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', self.language):
            errors.append("Language must contain only alphanumeric characters and underscores")
        
        # Validate code
        if not self.code or not isinstance(self.code, str):
            errors.append("Code is required and must be a string")
        elif len(self.code.strip()) == 0:
            errors.append("Code cannot be empty")
        elif len(self.code) > 50000:  # 50KB limit
            errors.append("Code is too long (maximum 50,000 characters)")
        
        # Validate input if provided
        if self.input is not None:
            if not isinstance(self.input, str):
                errors.append("Input must be a string")
            elif len(self.input) > 10000:  # 10KB limit for input
                errors.append("Input is too long (maximum 10,000 characters)")
        
        # Validate timeout if provided
        if self.timeout is not None:
            if not isinstance(self.timeout, int):
                errors.append("Timeout must be an integer")
            elif self.timeout < 1 or self.timeout > 60:
                errors.append("Timeout must be between 1 and 60 seconds")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def sanitize(self) -> 'ExecutionRequest':
        """
        Sanitize the execution request to prevent basic security issues.
        
        Returns:
            New ExecutionRequest with sanitized data
        """
        # Sanitize code - remove null bytes and normalize line endings
        sanitized_code = self.code.replace('\x00', '').replace('\r\n', '\n').replace('\r', '\n')
        
        # Sanitize input if provided
        sanitized_input = None
        if self.input is not None:
            sanitized_input = self.input.replace('\x00', '').replace('\r\n', '\n').replace('\r', '\n')
        
        # Sanitize language - lowercase and strip
        sanitized_language = self.language.lower().strip()
        
        return ExecutionRequest(
            language=sanitized_language,
            code=sanitized_code,
            input=sanitized_input,
            timeout=self.timeout
        )

@dataclass
class ExecutionResult:
    """Model for code execution results."""
    success: bool
    output: str = ""
    error: Optional[str] = None
    execution_time: float = 0.0
    memory_usage: Optional[int] = None
    timeout: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert execution result to dictionary for JSON serialization."""
        result = {
            'success': self.success,
            'output': self.output,
            'execution_time': self.execution_time,
            'timeout': self.timeout
        }
        
        if self.error:
            # Handle both string and dict errors
            if isinstance(self.error, dict):
                result['error'] = self.error
            else:
                result['error'] = str(self.error)
        
        if self.memory_usage is not None:
            result['memory_usage'] = self.memory_usage
            
        return result

@dataclass
class ExecutionError:
    """Model for execution errors."""
    type: str
    message: str
    line: Optional[int] = None
    details: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert execution error to dictionary for JSON serialization."""
        result = {
            'type': self.type,
            'message': self.message
        }
        
        if self.line is not None:
            result['line'] = self.line
            
        if self.details:
            result['details'] = self.details
            
        return result

def create_execution_request(data: Dict[str, Any]) -> ExecutionRequest:
    """
    Create an ExecutionRequest from dictionary data.
    
    Args:
        data: Dictionary containing request data
        
    Returns:
        ExecutionRequest instance
    """
    return ExecutionRequest(
        language=data.get('language', ''),
        code=data.get('code', ''),
        input=data.get('input'),
        timeout=data.get('timeout')
    )

def create_error_result(error_type: str, message: str, details: str = None) -> ExecutionResult:
    """
    Create an ExecutionResult for error cases.
    
    Args:
        error_type: Type of error
        message: Error message
        details: Additional error details
        
    Returns:
        ExecutionResult with error information
    """
    return ExecutionResult(
        success=False,
        error=ExecutionError(
            type=error_type,
            message=message,
            details=details
        ).to_dict()
    )