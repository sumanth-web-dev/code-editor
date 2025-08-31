"""
Admin routes for AI service management and monitoring.
"""

import logging
from flask import Blueprint, jsonify, request
from app.services.enhanced_ai_service import enhanced_ai_service
from app.middleware.rate_limiter import rate_limit

logger = logging.getLogger(__name__)

# Create admin blueprint
ai_admin_bp = Blueprint('ai_admin', __name__)

@ai_admin_bp.route('/ai/status')
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_ai_status():
    """Get comprehensive AI service status."""
    try:
        status = enhanced_ai_service.get_provider_status()
        
        return jsonify({
            'success': True,
            'providers': status,
            'cache_size': len(enhanced_ai_service.cache),
            'total_providers': len(enhanced_ai_service.provider_configs),
            'available_providers': enhanced_ai_service.get_available_providers(),
            'configured_providers': enhanced_ai_service.get_configured_providers()
        })
        
    except Exception as e:
        logger.error(f"Error getting AI status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_admin_bp.route('/ai/providers/<provider>/reset', methods=['POST'])
@rate_limit(requests_per_minute=5, requests_per_hour=20)
def reset_provider_keys(provider: str):
    """Reset API keys for a specific provider (admin only)."""
    try:
        # In a real application, add admin authentication here
        # For now, we'll allow it but log the action
        logger.warning(f"API keys reset requested for provider: {provider}")
        
        success = enhanced_ai_service.reset_provider_keys(provider)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'API keys reset for provider {provider}',
                'provider': provider
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Provider {provider} not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Error resetting provider keys: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_admin_bp.route('/ai/providers/<provider>/status')
@rate_limit(requests_per_minute=60, requests_per_hour=500)
def get_provider_status(provider: str):
    """Get detailed status for a specific provider."""
    try:
        all_status = enhanced_ai_service.get_provider_status()
        
        if provider not in all_status:
            return jsonify({
                'success': False,
                'error': f'Provider {provider} not found'
            }), 404
        
        provider_status = all_status[provider]
        
        # Add detailed key information (without exposing actual keys)
        if provider in enhanced_ai_service.api_keys:
            keys_info = []
            for i, key in enumerate(enhanced_ai_service.api_keys[provider]):
                keys_info.append({
                    'key_id': i,
                    'is_active': key.is_active,
                    'failure_count': key.failure_count,
                    'last_failure': key.last_failure.isoformat() if key.last_failure else None,
                    'last_success': key.last_success.isoformat() if key.last_success else None,
                    'rate_limit_reset': key.rate_limit_reset.isoformat() if key.rate_limit_reset else None,
                    'total_requests': key.total_requests,
                    'successful_requests': key.successful_requests,
                    'success_rate': key.successful_requests / max(key.total_requests, 1)
                })
            provider_status['keys'] = keys_info
        
        return jsonify({
            'success': True,
            'provider': provider,
            'status': provider_status
        })
        
    except Exception as e:
        logger.error(f"Error getting provider status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_admin_bp.route('/ai/cache/clear', methods=['POST'])
@rate_limit(requests_per_minute=5, requests_per_hour=20)
def clear_ai_cache():
    """Clear AI service cache."""
    try:
        cache_size = len(enhanced_ai_service.cache)
        enhanced_ai_service.cache.clear()
        
        logger.info(f"AI cache cleared, removed {cache_size} entries")
        
        return jsonify({
            'success': True,
            'message': f'Cache cleared, removed {cache_size} entries',
            'cleared_entries': cache_size
        })
        
    except Exception as e:
        logger.error(f"Error clearing AI cache: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_admin_bp.route('/ai/test/<provider>', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def test_provider(provider: str):
    """Test a specific AI provider with a simple request."""
    try:
        test_code = "print('Hello, World!')"
        
        result = enhanced_ai_service.analyze_code(
            code=test_code,
            language='python',
            explain_level='short',
            preferred_provider=provider
        )
        
        return jsonify({
            'success': True,
            'test_result': result,
            'provider': provider
        })
        
    except Exception as e:
        logger.error(f"Error testing provider {provider}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_admin_bp.route('/ai/config')
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_ai_config():
    """Get AI service configuration."""
    try:
        config = {}
        
        for provider, provider_config in enhanced_ai_service.provider_configs.items():
            config[provider] = {
                'name': provider_config.name,
                'priority': provider_config.priority,
                'cost_per_token': provider_config.cost_per_token,
                'max_tokens': provider_config.max_tokens,
                'timeout': provider_config.timeout,
                'retry_count': provider_config.retry_count,
                'models': provider_config.models,
                'is_enabled': provider_config.is_enabled,
                'has_keys': provider in enhanced_ai_service.api_keys,
                'key_count': len(enhanced_ai_service.api_keys.get(provider, []))
            }
        
        return jsonify({
            'success': True,
            'config': config,
            'cache_ttl_minutes': enhanced_ai_service.cache_ttl.total_seconds() / 60
        })
        
    except Exception as e:
        logger.error(f"Error getting AI config: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_admin_bp.route('/ai/providers/<provider>/enable', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def enable_provider(provider: str):
    """Enable a specific provider."""
    try:
        if provider not in enhanced_ai_service.provider_configs:
            return jsonify({
                'success': False,
                'error': f'Provider {provider} not found'
            }), 404
        
        enhanced_ai_service.provider_configs[provider].is_enabled = True
        
        logger.info(f"Provider {provider} enabled")
        
        return jsonify({
            'success': True,
            'message': f'Provider {provider} enabled',
            'provider': provider
        })
        
    except Exception as e:
        logger.error(f"Error enabling provider {provider}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_admin_bp.route('/ai/providers/<provider>/disable', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def disable_provider(provider: str):
    """Disable a specific provider."""
    try:
        if provider not in enhanced_ai_service.provider_configs:
            return jsonify({
                'success': False,
                'error': f'Provider {provider} not found'
            }), 404
        
        enhanced_ai_service.provider_configs[provider].is_enabled = False
        
        logger.info(f"Provider {provider} disabled")
        
        return jsonify({
            'success': True,
            'message': f'Provider {provider} disabled',
            'provider': provider
        })
        
    except Exception as e:
        logger.error(f"Error disabling provider {provider}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500