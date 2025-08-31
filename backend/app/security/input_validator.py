"""
Input validation and sanitization for security.
"""

import re
import html
import logging
from typing import Dict, List, Any, Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class InputValidator:
    """Input validation and sanitization utilities."""
    
    # Dangerous patterns that should be blocked
    DANGEROUS_PATTERNS = [
        # System commands
        r'(?i)\b(rm\s+(-rf\s+)?[/\\]|del\s+[/\\]|format\s+[a-z]:)',
        r'(?i)\b(shutdown|reboot|halt|poweroff)\b',
        r'(?i)\b(sudo|su\s+root|chmod\s+777)\b',
        
        # Network operations
        r'(?i)\b(wget|curl|nc|netcat|telnet|ssh|ftp)\b',
        r'(?i)\b(ping|nslookup|dig|host)\b',
        
        # File system operations
        r'(?i)\b(find\s+/|ls\s+/|cat\s+/etc/|head\s+/etc/|tail\s+/etc/)\b',
        r'(?i)\b(mount|umount|fdisk|mkfs)\b',
        
        # Process operations
        r'(?i)\b(ps\s+aux|kill\s+-9|killall|pkill)\b',
        r'(?i)\b(nohup|screen|tmux|bg|fg|jobs)\b',
        
        # Code injection attempts
        r'(?i)(__import__|exec|eval|compile)\s*\(',
        r'(?i)\b(popen|subprocess|os\.system)\b',
        r'(?i)\bsystem\s*\(',  # More specific - only system() calls, not System.out
        r'(?i)\b(shell_exec|passthru)\b',  # PHP - removed generic 'exec' and 'system'
        r'(?i)\b(Runtime\.getRuntime|ProcessBuilder)\b',  # Java
        
        # File inclusion attempts
        r'(?i)\b(include|require|import)\s+["\'][^"\']*\.\./[^"\']*["\']',
        r'(?i)\b(file_get_contents|fopen|readfile)\s*\(',
        
        # SQL injection patterns
        r'(?i)\b(union\s+select|drop\s+table|delete\s+from|insert\s+into)\b',
        r'(?i)\b(or\s+1\s*=\s*1|and\s+1\s*=\s*1)\b',
        
        # XSS patterns
        r'(?i)<script[^>]*>.*?</script>',
        r'(?i)javascript\s*:',
        r'(?i)on\w+\s*=\s*["\'][^"\']*["\']',
        
        # Path traversal
        r'\.\.[\\/]',
        r'(?i)[\\/]etc[\\/]passwd',
        r'(?i)[\\/]proc[\\/]',
        
        # Environment variable access
        r'(?i)\$\{[^}]*\}',
        r'(?i)%[A-Z_]+%',
        
        # Dangerous file extensions in strings
        r'(?i)\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|sh|ps1|py|pl|rb)\b',
    ]
    
    # Compile patterns for better performance
    COMPILED_PATTERNS = [re.compile(pattern) for pattern in DANGEROUS_PATTERNS]
    
    # Maximum lengths for different input types
    MAX_LENGTHS = {
        'code': 50000,  # 50KB max code
        'input': 10000,  # 10KB max input
        'language': 20,  # Language identifier
        'filename': 255,  # Filename
        'general': 1000   # General text input
    }
    
    # Allowed characters for different input types
    ALLOWED_CHARS = {
        'language': re.compile(r'^[a-zA-Z0-9_+-]+$'),
        'filename': re.compile(r'^[a-zA-Z0-9._-]+$'),
        'alphanumeric': re.compile(r'^[a-zA-Z0-9]+$'),
    }
    
    @classmethod
    def validate_code_input(cls, code: str, language: str) -> Tuple[bool, List[str]]:
        """
        Validate code input for security issues.
        
        Args:
            code: Code to validate
            language: Programming language
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check if code is provided
        if not code or not isinstance(code, str):
            errors.append("Code is required and must be a string")
            return False, errors
        
        # Check code length
        if len(code) > cls.MAX_LENGTHS['code']:
            errors.append(f"Code exceeds maximum length of {cls.MAX_LENGTHS['code']} characters")
        
        # Dangerous pattern checking has been removed
        
        # Language-specific validation
        language_errors = cls._validate_language_specific(code, language)
        errors.extend(language_errors)
        
        # Resource usage checking has been removed
        
        return len(errors) == 0, errors
    
    @classmethod
    def validate_user_input(cls, user_input: str) -> Tuple[bool, List[str]]:
        """
        Validate user input for interactive programs.
        
        Args:
            user_input: User input to validate
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        if user_input is None:
            return True, []  # Input is optional
        
        if not isinstance(user_input, str):
            errors.append("User input must be a string")
            return False, errors
        
        # Check input length
        if len(user_input) > cls.MAX_LENGTHS['input']:
            errors.append(f"Input exceeds maximum length of {cls.MAX_LENGTHS['input']} characters")
        
        # Dangerous pattern checking has been removed
        
        return len(errors) == 0, errors
    
    @classmethod
    def validate_language(cls, language: str) -> Tuple[bool, List[str]]:
        """
        Validate programming language identifier.
        
        Args:
            language: Language identifier
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        if not language or not isinstance(language, str):
            errors.append("Language is required and must be a string")
            return False, errors
        
        # Check length
        if len(language) > cls.MAX_LENGTHS['language']:
            errors.append(f"Language identifier too long (max {cls.MAX_LENGTHS['language']} chars)")
        
        # Check allowed characters
        if not cls.ALLOWED_CHARS['language'].match(language):
            errors.append("Language identifier contains invalid characters")
        
        return len(errors) == 0, errors
    
    @classmethod
    def sanitize_code(cls, code: str) -> str:
        """
        Sanitize code input by removing or escaping dangerous content.
        
        Args:
            code: Code to sanitize
            
        Returns:
            Sanitized code
        """
        if not isinstance(code, str):
            return ""
        
        # Remove null bytes and control characters (except newlines and tabs)
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', code)
        
        # Normalize line endings
        sanitized = sanitized.replace('\r\n', '\n').replace('\r', '\n')
        
        # Limit consecutive newlines
        sanitized = re.sub(r'\n{10,}', '\n' * 10, sanitized)
        
        # Remove leading/trailing whitespace but preserve internal formatting
        sanitized = sanitized.strip()
        
        return sanitized
    
    @classmethod
    def sanitize_user_input(cls, user_input: str) -> str:
        """
        Sanitize user input for interactive programs.
        
        Args:
            user_input: User input to sanitize
            
        Returns:
            Sanitized input
        """
        if not isinstance(user_input, str):
            return ""
        
        # Remove null bytes and most control characters
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', user_input)
        
        # Normalize line endings
        sanitized = sanitized.replace('\r\n', '\n').replace('\r', '\n')
        
        # HTML escape to prevent XSS if input is ever displayed
        sanitized = html.escape(sanitized)
        
        return sanitized
    
    @classmethod
    def _check_dangerous_patterns(cls, text: str) -> List[str]:
        """
        Check text for dangerous patterns.
        
        Args:
            text: Text to check
            
        Returns:
            List of matched dangerous patterns
        """
        matches = []
        
        for i, pattern in enumerate(cls.COMPILED_PATTERNS):
            if pattern.search(text):
                # Get a description of what was matched
                pattern_desc = cls.DANGEROUS_PATTERNS[i]
                matches.append(f"Pattern {i+1}")
                
                # Log the specific match for security monitoring
                logger.warning(f"Dangerous pattern detected: {pattern_desc}")
        
        return matches
    
    @classmethod
    def _validate_language_specific(cls, code: str, language: str) -> List[str]:
        """
        Perform language-specific validation.
        
        Args:
            code: Code to validate
            language: Programming language
            
        Returns:
            List of validation errors (now empty - validation removed)
        """
        # All language-specific validation has been removed
        return []
    
    @classmethod
    def _check_resource_usage(cls, code: str) -> List[str]:
        """
        Check for patterns that might cause excessive resource usage.
        
        Args:
            code: Code to check
            
        Returns:
            List of resource usage warnings
        """
        warnings = []
        
        # Check for infinite loops patterns
        infinite_loop_patterns = [
            r'\bwhile\s*\(\s*true\s*\)',
            r'\bwhile\s*\(\s*1\s*\)',
            r'\bfor\s*\(\s*;\s*;\s*\)',
            r'\bwhile\s+True\s*:',
            r'\bwhile\s+1\s*:',
        ]
        
        for pattern in infinite_loop_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                warnings.append("Potential infinite loop detected")
                break
        
        # Check for large memory allocations
        memory_patterns = [
            r'\bnew\s+\w+\[\s*\d{6,}\s*\]',  # Large array allocation
            r'\b\w+\s*=\s*\[\s*\d+\s*\]\s*\*\s*\d{6,}',  # Large list multiplication
            r'\bmalloc\s*\(\s*\d{6,}\s*\)',  # Large malloc
        ]
        
        for pattern in memory_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                warnings.append("Large memory allocation detected")
                break
        
        # Check for excessive recursion (function calling itself within its own definition)
        # Look for function definitions that call themselves within their body
        function_defs = re.finditer(r'\bdef\s+(\w+)\s*\([^)]*\)\s*:', code)
        for match in function_defs:
            func_name = match.group(1)
            # Find the function body (indented lines after the definition)
            start_pos = match.end()
            lines = code[start_pos:].split('\n')
            func_body = []
            for line in lines:
                if line.strip() == '':
                    continue
                if line.startswith('    ') or line.startswith('\t'):  # Indented line (function body)
                    func_body.append(line)
                elif line.strip():  # Non-indented, non-empty line (end of function)
                    break
            
            # Check if function calls itself within its own body
            func_body_text = '\n'.join(func_body)
            if re.search(rf'\b{func_name}\s*\(', func_body_text):
                warnings.append("Potential recursive function detected")
        
        return warnings
    
    @classmethod
    def validate_execution_request(cls, data: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Validate and sanitize a complete execution request.
        
        Args:
            data: Request data dictionary
            
        Returns:
            Tuple of (is_valid, errors, sanitized_data)
        """
        errors = []
        sanitized_data = {}
        
        # Validate required fields
        if 'language' not in data:
            errors.append("Language is required")
        else:
            lang_valid, lang_errors = cls.validate_language(data['language'])
            if not lang_valid:
                errors.extend(lang_errors)
            else:
                sanitized_data['language'] = data['language'].lower().strip()
        
        if 'code' not in data:
            errors.append("Code is required")
        else:
            code_valid, code_errors = cls.validate_code_input(
                data['code'], 
                data.get('language', '')
            )
            if not code_valid:
                errors.extend(code_errors)
            else:
                sanitized_data['code'] = cls.sanitize_code(data['code'])
        
        # Validate optional fields
        if 'input' in data and data['input'] is not None:
            input_valid, input_errors = cls.validate_user_input(data['input'])
            if not input_valid:
                errors.extend(input_errors)
            else:
                sanitized_data['input'] = cls.sanitize_user_input(data['input'])
        
        # Validate timeout
        if 'timeout' in data:
            timeout = data['timeout']
            if not isinstance(timeout, (int, float)) or timeout <= 0 or timeout > 300:
                errors.append("Timeout must be a positive number <= 300 seconds")
            else:
                sanitized_data['timeout'] = min(int(timeout), 300)
        
        return len(errors) == 0, errors, sanitized_data

# Global validator instance
input_validator = InputValidator()