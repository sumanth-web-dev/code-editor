"""
Enhanced AI service with API key rotation, error handling, and multi-model failover.
"""

import os
import logging
import time
import json
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from threading import Lock
import random

logger = logging.getLogger(__name__)

@dataclass
class APIKey:
    """Represents an API key with its status and usage tracking."""
    key: str
    provider: str
    is_active: bool = True
    failure_count: int = 0
    last_failure: Optional[datetime] = None
    last_success: Optional[datetime] = None
    rate_limit_reset: Optional[datetime] = None
    total_requests: int = 0
    successful_requests: int = 0
    
    def mark_failure(self, error_type: str = "unknown"):
        """Mark this key as failed and increment failure count."""
        self.failure_count += 1
        self.last_failure = datetime.now()
        
        # Temporarily disable key if too many failures
        if self.failure_count >= 3:
            self.is_active = False
            logger.warning(f"API key for {self.provider} disabled due to {self.failure_count} failures")
    
    def mark_success(self):
        """Mark this key as successful and reset failure count."""
        self.failure_count = 0
        self.last_success = datetime.now()
        self.successful_requests += 1
        self.total_requests += 1
    
    def mark_rate_limited(self, reset_time: Optional[datetime] = None):
        """Mark this key as rate limited."""
        self.rate_limit_reset = reset_time or datetime.now() + timedelta(minutes=5)
        self.is_active = False
        logger.warning(f"API key for {self.provider} rate limited until {self.rate_limit_reset}")
    
    def can_use(self) -> bool:
        """Check if this key can be used."""
        if not self.is_active:
            # Check if rate limit has expired
            if self.rate_limit_reset and datetime.now() > self.rate_limit_reset:
                self.is_active = True
                self.rate_limit_reset = None
                logger.info(f"API key for {self.provider} reactivated after rate limit")
                return True
            return False
        return True

@dataclass
class ProviderConfig:
    """Configuration for an AI provider."""
    name: str
    priority: int = 1  # Lower number = higher priority
    cost_per_token: float = 0.0
    max_tokens: int = 2000
    timeout: int = 30
    retry_count: int = 3
    models: List[str] = field(default_factory=list)
    is_enabled: bool = True

class EnhancedAIService:
    """Enhanced AI service with key rotation, error handling, and failover."""
    
    def __init__(self):
        self.api_keys: Dict[str, List[APIKey]] = {}
        self.provider_configs: Dict[str, ProviderConfig] = {}
        self.providers: Dict[str, Any] = {}
        self.lock = Lock()
        self.cache: Dict[str, Tuple[Dict, datetime]] = {}
        self.cache_ttl = timedelta(minutes=5)
        
        self._initialize_providers()
        self._load_api_keys()
    
    def _initialize_providers(self):
        """Initialize provider configurations."""
        self.provider_configs = {
            'openai': ProviderConfig(
                name='openai',
                priority=1,
                cost_per_token=0.002,
                max_tokens=2000,
                models=['gpt-3.5-turbo', 'gpt-4']
            ),
            'gemini': ProviderConfig(
                name='gemini',
                priority=2,
                cost_per_token=0.001,
                max_tokens=2000,
                models=['gemini-1.5-flash', 'gemini-pro']
            ),
            'together': ProviderConfig(
                name='together',
                priority=3,
                cost_per_token=0.0005,
                max_tokens=2000,
                models=['meta-llama/Llama-3-8b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1']
            )
        }
        
        # Import and initialize provider services
        try:
            from .gpt_service import gpt_service
            from .gemini_service import gemini_service
            from .together_service import together_service
            
            self.providers = {
                'openai': gpt_service,
                'gemini': gemini_service,
                'together': together_service
            }
        except ImportError as e:
            logger.error(f"Failed to import AI services: {e}")
    
    def _load_api_keys(self):
        """Load API keys from environment variables."""
        # Load OpenAI keys
        openai_keys = []
        if os.getenv('OPENAI_API_KEY'):
            openai_keys.append(APIKey(os.getenv('OPENAI_API_KEY'), 'openai'))
        
        # Support multiple OpenAI keys
        for i in range(1, 6):  # Support up to 5 keys per provider
            key = os.getenv(f'OPENAI_API_KEY_{i}')
            if key:
                openai_keys.append(APIKey(key, 'openai'))
        
        if openai_keys:
            self.api_keys['openai'] = openai_keys
        
        # Load Gemini keys
        gemini_keys = []
        if os.getenv('GEMINI_API_KEY'):
            gemini_keys.append(APIKey(os.getenv('GEMINI_API_KEY'), 'gemini'))
        
        for i in range(1, 6):
            key = os.getenv(f'GEMINI_API_KEY_{i}')
            if key:
                gemini_keys.append(APIKey(key, 'gemini'))
        
        if gemini_keys:
            self.api_keys['gemini'] = gemini_keys
        
        # Load Together AI keys
        together_keys = []
        if os.getenv('TOGETHER_API_KEY'):
            together_keys.append(APIKey(os.getenv('TOGETHER_API_KEY'), 'together'))
        
        for i in range(1, 6):
            key = os.getenv(f'TOGETHER_API_KEY_{i}')
            if key:
                together_keys.append(APIKey(key, 'together'))
        
        if together_keys:
            self.api_keys['together'] = together_keys
        
        logger.info(f"Loaded API keys: {[(provider, len(keys)) for provider, keys in self.api_keys.items()]}")
    
    def get_available_key(self, provider: str) -> Optional[APIKey]:
        """Get an available API key for the specified provider."""
        with self.lock:
            if provider not in self.api_keys:
                return None
            
            # Filter active keys
            active_keys = [key for key in self.api_keys[provider] if key.can_use()]
            
            if not active_keys:
                # Try to reactivate failed keys after some time
                for key in self.api_keys[provider]:
                    if (key.last_failure and 
                        datetime.now() - key.last_failure > timedelta(minutes=10)):
                        key.is_active = True
                        key.failure_count = max(0, key.failure_count - 1)
                        active_keys.append(key)
                        logger.info(f"Reactivated API key for {provider} after cooldown")
            
            if not active_keys:
                return None
            
            # Return key with best success rate
            return min(active_keys, key=lambda k: k.failure_count)
    
    def get_ordered_providers(self, preferred_provider: Optional[str] = None) -> List[str]:
        """Get providers ordered by priority and availability."""
        available_providers = []
        
        # Add preferred provider first if available
        if preferred_provider and preferred_provider in self.api_keys:
            if self.get_available_key(preferred_provider):
                available_providers.append(preferred_provider)
        
        # Add other providers by priority
        other_providers = [
            (provider, config.priority) 
            for provider, config in self.provider_configs.items()
            if (provider != preferred_provider and 
                provider in self.api_keys and 
                self.get_available_key(provider) and
                config.is_enabled)
        ]
        
        # Sort by priority (lower number = higher priority)
        other_providers.sort(key=lambda x: x[1])
        available_providers.extend([provider for provider, _ in other_providers])
        
        return available_providers
    
    def _get_cache_key(self, operation: str, **kwargs) -> str:
        """Generate cache key for request."""
        key_data = {
            'operation': operation,
            **kwargs
        }
        return json.dumps(key_data, sort_keys=True)
    
    def _get_cached_result(self, cache_key: str) -> Optional[Dict]:
        """Get cached result if available and not expired."""
        if cache_key in self.cache:
            result, timestamp = self.cache[cache_key]
            if datetime.now() - timestamp < self.cache_ttl:
                return result
            else:
                del self.cache[cache_key]
        return None
    
    def _cache_result(self, cache_key: str, result: Dict):
        """Cache successful result."""
        if result.get('success'):
            self.cache[cache_key] = (result, datetime.now())
    
    def _execute_with_provider(self, provider: str, operation: str, **kwargs) -> Dict:
        """Execute operation with specific provider and handle errors."""
        api_key = self.get_available_key(provider)
        if not api_key:
            return {
                'success': False,
                'error': f'No available API keys for provider {provider}',
                'provider': provider
            }
        
        service = self.providers.get(provider)
        if not service:
            return {
                'success': False,
                'error': f'Provider {provider} service not available',
                'provider': provider
            }
        
        try:
            # Update service with current API key
            if hasattr(service, 'api_key'):
                service.api_key = api_key.key
            if hasattr(service, '_initialize_client'):
                service._initialize_client()
            
            # Execute operation
            if operation == 'analyze_code':
                result = service.analyze_code(
                    kwargs['code'], 
                    kwargs['language'], 
                    kwargs.get('explain_level', 'medium')
                )
            elif operation == 'generate_code':
                result = service.generate_code(
                    kwargs['prompt'], 
                    kwargs['language'], 
                    kwargs.get('explain_level', 'medium')
                )
            else:
                return {
                    'success': False,
                    'error': f'Unknown operation: {operation}',
                    'provider': provider
                }
            
            if result.get('success'):
                api_key.mark_success()
                result['provider'] = provider
                result['api_key_id'] = id(api_key)
                return result
            else:
                # Handle specific error types
                error_msg = result.get('error', '').lower()
                if 'rate limit' in error_msg or 'quota' in error_msg:
                    api_key.mark_rate_limited()
                elif 'invalid' in error_msg and 'key' in error_msg:
                    api_key.mark_failure('invalid_key')
                else:
                    api_key.mark_failure('api_error')
                
                result['provider'] = provider
                return result
        
        except Exception as e:
            error_msg = str(e).lower()
            if 'rate limit' in error_msg or 'quota' in error_msg:
                api_key.mark_rate_limited()
            elif 'timeout' in error_msg:
                api_key.mark_failure('timeout')
            elif 'invalid' in error_msg and 'key' in error_msg:
                api_key.mark_failure('invalid_key')
            else:
                api_key.mark_failure('exception')
            
            logger.error(f"Error with provider {provider}: {e}")
            return {
                'success': False,
                'error': f'Provider {provider} failed: {str(e)}',
                'provider': provider
            }
    
    def analyze_code(self, code: str, language: str, explain_level: str = "medium", 
                    preferred_provider: Optional[str] = None) -> Dict:
        """
        Analyze code with automatic failover between providers.
        """
        # Check cache first
        cache_key = self._get_cache_key('analyze_code', code=code, language=language, explain_level=explain_level)
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            cached_result['from_cache'] = True
            return cached_result
        
        providers = self.get_ordered_providers(preferred_provider)
        
        if not providers:
            return {
                'success': False,
                'error': 'No AI providers available. Please check API key configuration.',
                'available_providers': list(self.api_keys.keys())
            }
        
        last_error = None
        attempted_providers = []
        
        for provider in providers:
            logger.info(f"Attempting code analysis with provider: {provider}")
            attempted_providers.append(provider)
            
            result = self._execute_with_provider(
                provider, 'analyze_code',
                code=code, language=language, explain_level=explain_level
            )
            
            if result.get('success'):
                result['attempted_providers'] = attempted_providers
                self._cache_result(cache_key, result)
                return result
            else:
                last_error = result.get('error')
                logger.warning(f"Provider {provider} failed: {last_error}")
        
        # All providers failed
        return {
            'success': False,
            'error': f'All providers failed. Last error: {last_error}',
            'attempted_providers': attempted_providers,
            'available_providers': list(self.api_keys.keys())
        }
    
    def generate_code(self, prompt: str, language: str, explain_level: str = "medium",
                     preferred_provider: Optional[str] = None) -> Dict:
        """
        Generate code with automatic failover between providers.
        """
        # Check cache first
        cache_key = self._get_cache_key('generate_code', prompt=prompt, language=language, explain_level=explain_level)
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            cached_result['from_cache'] = True
            return cached_result
        
        providers = self.get_ordered_providers(preferred_provider)
        
        if not providers:
            return {
                'success': False,
                'error': 'No AI providers available. Please check API key configuration.',
                'available_providers': list(self.api_keys.keys())
            }
        
        last_error = None
        attempted_providers = []
        
        for provider in providers:
            logger.info(f"Attempting code generation with provider: {provider}")
            attempted_providers.append(provider)
            
            result = self._execute_with_provider(
                provider, 'generate_code',
                prompt=prompt, language=language, explain_level=explain_level
            )
            
            if result.get('success'):
                result['attempted_providers'] = attempted_providers
                self._cache_result(cache_key, result)
                return result
            else:
                last_error = result.get('error')
                logger.warning(f"Provider {provider} failed: {last_error}")
        
        # All providers failed
        return {
            'success': False,
            'error': f'All providers failed. Last error: {last_error}',
            'attempted_providers': attempted_providers,
            'available_providers': list(self.api_keys.keys())
        }
    
    def get_provider_status(self) -> Dict:
        """Get status of all providers and their API keys."""
        status = {}
        
        for provider, keys in self.api_keys.items():
            active_keys = sum(1 for key in keys if key.can_use())
            total_requests = sum(key.total_requests for key in keys)
            successful_requests = sum(key.successful_requests for key in keys)
            
            status[provider] = {
                'total_keys': len(keys),
                'active_keys': active_keys,
                'total_requests': total_requests,
                'successful_requests': successful_requests,
                'success_rate': successful_requests / max(total_requests, 1),
                'is_available': active_keys > 0,
                'config': self.provider_configs.get(provider, {})
            }
        
        return status
    
    def reset_provider_keys(self, provider: str) -> bool:
        """Reset all keys for a provider (admin function)."""
        if provider not in self.api_keys:
            return False
        
        with self.lock:
            for key in self.api_keys[provider]:
                key.is_active = True
                key.failure_count = 0
                key.rate_limit_reset = None
                key.last_failure = None
        
        logger.info(f"Reset all keys for provider {provider}")
        return True
    
    def is_any_provider_configured(self) -> bool:
        """Check if any provider is configured and available."""
        return any(self.get_available_key(provider) for provider in self.api_keys.keys())
    
    def get_available_providers(self) -> Dict[str, bool]:
        """Get list of available providers."""
        return {
            provider: self.get_available_key(provider) is not None
            for provider in self.provider_configs.keys()
        }
    
    def get_configured_providers(self) -> List[str]:
        """Get list of configured providers."""
        return [
            provider for provider in self.api_keys.keys()
            if self.get_available_key(provider)
        ]

# Global enhanced service instance
enhanced_ai_service = EnhancedAIService()