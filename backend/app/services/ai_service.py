"""
Unified AI service that routes requests to different AI providers.
"""

import logging
from typing import Dict, Optional
from .gpt_service import gpt_service
from .gemini_service import gemini_service
from .together_service import together_service

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.providers = {
            'openai': gpt_service,
            'gemini': gemini_service,
            'together': together_service
        }
        self.default_provider = 'openai'
    
    def get_available_providers(self) -> Dict[str, bool]:
        """Get list of available AI providers and their configuration status."""
        return {
            provider: service.is_configured() 
            for provider, service in self.providers.items()
        }
    
    def get_configured_providers(self) -> list:
        """Get list of configured AI providers."""
        return [
            provider for provider, service in self.providers.items() 
            if service.is_configured()
        ]
    
    def is_any_provider_configured(self) -> bool:
        """Check if any AI provider is configured."""
        return any(service.is_configured() for service in self.providers.values())
    
    def get_service(self, provider: Optional[str] = None):
        """Get AI service for the specified provider."""
        if provider is None:
            # Try to find the first configured provider
            configured_providers = self.get_configured_providers()
            if not configured_providers:
                return None
            provider = configured_providers[0]
        
        if provider not in self.providers:
            logger.warning(f"Unknown AI provider: {provider}")
            return None
        
        service = self.providers[provider]
        if not service.is_configured():
            logger.warning(f"AI provider {provider} is not configured")
            return None
        
        return service
    
    def analyze_code(self, code: str, language: str, explain_level: str = "medium", 
                    provider: Optional[str] = None) -> Dict:
        """
        Analyze code using the specified AI provider.
        
        Args:
            code: The code to analyze
            language: Programming language
            explain_level: "short", "medium", or "long"
            provider: AI provider to use (openai, gemini, together)
        
        Returns:
            Dict containing analysis results
        """
        service = self.get_service(provider)
        if service is None:
            available_providers = self.get_configured_providers()
            if not available_providers:
                return {
                    'success': False,
                    'error': 'No AI providers are configured. Please set up at least one API key.'
                }
            else:
                return {
                    'success': False,
                    'error': f'Provider "{provider}" not available. Available providers: {", ".join(available_providers)}'
                }
        
        try:
            result = service.analyze_code(code, language, explain_level)
            # Add provider info to result
            if result.get('success'):
                result['provider'] = provider or self._get_provider_name(service)
            return result
        except Exception as e:
            logger.error(f"Error in AI analysis with provider {provider}: {e}")
            return {
                'success': False,
                'error': f'Analysis failed with provider {provider}: {str(e)}'
            }
    
    def generate_code(self, prompt: str, language: str, explain_level: str = "medium",
                     provider: Optional[str] = None) -> Dict:
        """
        Generate code using the specified AI provider.
        
        Args:
            prompt: User's code generation request
            language: Target programming language
            explain_level: Level of explanation detail
            provider: AI provider to use (openai, gemini, together)
        
        Returns:
            Dict containing generated code and explanation
        """
        service = self.get_service(provider)
        if service is None:
            available_providers = self.get_configured_providers()
            if not available_providers:
                return {
                    'success': False,
                    'error': 'No AI providers are configured. Please set up at least one API key.'
                }
            else:
                return {
                    'success': False,
                    'error': f'Provider "{provider}" not available. Available providers: {", ".join(available_providers)}'
                }
        
        try:
            result = service.generate_code(prompt, language, explain_level)
            # Add provider info to result
            if result.get('success'):
                result['provider'] = provider or self._get_provider_name(service)
            return result
        except Exception as e:
            logger.error(f"Error in AI code generation with provider {provider}: {e}")
            return {
                'success': False,
                'error': f'Code generation failed with provider {provider}: {str(e)}'
            }
    
    def _get_provider_name(self, service) -> str:
        """Get provider name from service instance."""
        for provider, provider_service in self.providers.items():
            if provider_service is service:
                return provider
        return 'unknown'

# Global service instance
ai_service = AIService()