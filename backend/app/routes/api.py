"""
Main API blueprint for the multi-language code editor.
"""

import logging
import uuid
from flask import Blueprint, jsonify, request, session, current_app
from app.models.language import get_all_languages
from app.models.execution import create_execution_request, create_error_result
from app.services.execution_service import execution_service
try:
    from app.services.enhanced_ai_service import enhanced_ai_service as ai_service
except ImportError:
    try:
        from app.services.ai_service import ai_service
    except ImportError:
        ai_service = None
from app.services.usage_service import usage_service
from app.services.git_service import git_service
from app.middleware.rate_limiter import rate_limit
from app.security.input_validator import input_validator
from app.database.plan_repository import PlanRepository
from app.database.usage_repository import UsageRepository
from app.database.payment_repository import PaymentRepository
from app.database.subscription_repository import SubscriptionRepository
from app.database.activity_repository import ActivityRepository
from app.services.auth_service import auth_service
from app.models.user import UserRole

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create API blueprint
api_bp = Blueprint('api', __name__)

@api_bp.route('/health')
def api_health():
    """API health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'multi-language-code-editor-api',
        'version': '1.0.0'
    })

@api_bp.route('/languages')
@rate_limit(requests_per_minute=60, requests_per_hour=1000)
def get_languages():
    """Get all supported programming languages."""
    try:
        languages = get_all_languages()
        return jsonify({
            'success': True,
            'languages': [lang.to_dict() for lang in languages],
            'count': len(languages)
        })
    except Exception as e:
        logger.error(f"Error retrieving languages: {str(e)}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'server_error',
                'message': 'Failed to retrieve languages',
                'details': str(e)
            }
        }), 500

@api_bp.route('/execute', methods=['POST'])
@rate_limit(requests_per_minute=30, requests_per_hour=500)
def execute_code():
    """
    Execute code in the specified programming language.
    
    Expected JSON payload:
    {
        "language": "python",
        "code": "print('Hello World')",
        "input": "optional user input",
        "timeout": 30
    }
    
    Returns:
    {
        "success": true,
        "output": "Hello World\n",
        "execution_time": 0.123,
        "session_id": "uuid"
    }
    """
    try:
        # Ensure session exists for isolation
        if 'session_id' not in session:
            session['session_id'] = str(uuid.uuid4())
            session['execution_count'] = 0
        
        session_id = session['session_id']
        
        # Rate limiting: max 100 executions per session
        if session.get('execution_count', 0) >= 100:
            logger.warning(f"Rate limit exceeded for session {session_id}")
            return jsonify({
                'success': False,
                'error': {
                    'type': 'rate_limit_error',
                    'message': 'Too many executions. Please refresh the page to reset.',
                    'details': 'Maximum 100 executions per session'
                }
            }), 429
        
        # Validate request content type
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'invalid_request',
                    'message': 'Request must be JSON',
                    'details': 'Content-Type must be application/json'
                }
            }), 400
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': {
                    'type': 'invalid_request',
                    'message': 'Empty request body',
                    'details': 'Request body must contain JSON data'
                }
            }), 400
        
        # Enhanced input validation and sanitization
        is_valid, validation_errors, sanitized_data = input_validator.validate_execution_request(data)
        if not is_valid:
            logger.warning(f"Input validation failed for session {session_id}: {validation_errors}")
            return jsonify({
                'success': False,
                'error': {
                    'type': 'validation_error',
                    'message': 'Invalid input data',
                    'details': '; '.join(validation_errors)
                }
            }), 400
        
        # Log execution attempt with sanitized data
        logger.info(f"Code execution request from session {session_id}: language={sanitized_data.get('language')}")
        
        # Create execution request with sanitized data
        try:
            execution_request = create_execution_request(sanitized_data)
        except Exception as e:
            logger.error(f"Error creating execution request: {str(e)}")
            return jsonify({
                'success': False,
                'error': {
                    'type': 'invalid_request',
                    'message': 'Invalid request data',
                    'details': str(e)
                }
            }), 400
        
        # --- Free plan usage enforcement ---
        user_id = session.get('user_id')
        if not user_id:
            user_id = 1
        plans = PlanRepository.get_all_plans()
        free_plan = next((p for p in plans if p.name.lower() == 'free trial'), None)
        usage_today = UsageRepository.get_user_usage_today(user_id)
        # Check limits for code generation
        if free_plan:
            if usage_today['code_generation'] >= free_plan.features.get('executionLimit', 5):
                return jsonify({
                    'success': False,
                    'error': {
                        'type': 'rate_limit_error',
                        'message': 'Free code generation quota exceeded for today. Upgrade for more.'
                    }
                }), 429
            if usage_today['ai_analysis'] >= free_plan.features.get('aiAnalysisLimit', 5):
                return jsonify({
                    'success': False,
                    'error': {
                        'type': 'rate_limit_error',
                        'message': 'Free AI analysis quota exceeded for today. Upgrade for more.'
                    }
                }), 429
        # Execute code using the execution service
        result = execution_service.execute_code(execution_request)
        # Increment usage for both actions (for demo, increment both)
        UsageRepository.increment_usage(user_id, 'code_generation')
        UsageRepository.increment_usage(user_id, 'ai_analysis')
        # Increment execution count for rate limiting
        session['execution_count'] = session.get('execution_count', 0) + 1
        
        # Prepare response
        response_data = result.to_dict()
        response_data['session_id'] = session_id
        
        # Log execution result
        if result.success:
            logger.info(f"Code execution successful for session {session_id}: time={result.execution_time:.3f}s")
        else:
            logger.warning(f"Code execution failed for session {session_id}: {result.error}")
        
        # Return appropriate HTTP status code
        status_code = 200 if result.success else 400
        
        return jsonify(response_data), status_code
        
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Unexpected error in execute_code endpoint: {str(e)}", exc_info=True)
        
        return jsonify({
            'success': False,
            'error': {
                'type': 'server_error',
                'message': 'Internal server error',
                'details': 'An unexpected error occurred during code execution'
            }
        }), 500

@api_bp.route('/execute/status')
def execution_status():
    """
    Get execution status and session information.
    
    Returns session information and execution limits.
    """
    try:
        session_id = session.get('session_id', 'none')
        execution_count = session.get('execution_count', 0)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'execution_count': execution_count,
            'execution_limit': 100,
            'remaining_executions': max(0, 100 - execution_count),
            'supported_languages': execution_service.get_supported_languages()
        })
        
    except Exception as e:
        logger.error(f"Error getting execution status: {str(e)}")
        return jsonify({
            'success': False,
            'error': {
                'type': 'server_error',
                'message': 'Failed to get execution status',
                'details': str(e)
            }
        }), 500

@api_bp.route('/analyze', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def analyze_code():
    """
    Analyze code using GPT API.
    
    Expected JSON payload:
    {
        "code": "print('Hello World')",
        "language": "python",
        "explain_level": "medium"
    }
    
    Returns analysis with corrections, explanations, and examples.
    """
    try:
        # Validate request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Empty request body'
            }), 400
        
        # Validate required fields
        code = data.get('code', '').strip()
        language = data.get('language', '').strip()
        explain_level = data.get('explain_level', 'medium').strip()
        
        if not code:
            return jsonify({
                'success': False,
                'error': 'Code is required'
            }), 400
        
        if not language:
            return jsonify({
                'success': False,
                'error': 'Language is required'
            }), 400
        
        if explain_level not in ['short', 'medium', 'long']:
            explain_level = 'medium'
        
        # Check usage limits
        session_id = usage_service.get_session_id()
        can_use, message = usage_service.can_use_analysis(session_id)
        
        if not can_use:
            usage_info = usage_service.get_usage_info(session_id)
            return jsonify({
                'success': False,
                'error': message,
                'usage_info': usage_info
            }), 403
        
        # Get AI provider preference
        provider = data.get('provider')  # Optional provider selection
        
        # Check if AI service is available and configured
        if ai_service is None or not ai_service.is_any_provider_configured():
            available_providers = ai_service.get_available_providers() if ai_service else {}
            return jsonify({
                'success': False,
                'error': 'AI analysis service not configured. Please contact administrator.',
                'available_providers': available_providers
            }), 503
        
        # Get git diff if available
        git_diff_data = None
        include_git_diff = data.get('include_git_diff', True)  # Default to True
        
        if include_git_diff and git_service.git_available:
            try:
                # Try to get current git diff
                git_diff_result = git_service.get_current_diff()
                if git_diff_result.success and git_diff_result.has_changes:
                    git_diff_data = {
                        'has_changes': True,
                        'added_lines': git_diff_result.added_lines,
                        'removed_lines': git_diff_result.removed_lines,
                        'diff_lines': [
                            {
                                'line_number': line.line_number,
                                'content': line.content,
                                'type': line.type
                            }
                            for line in git_diff_result.diff_lines
                        ]
                    }
                else:
                    git_diff_data = {'has_changes': False, 'message': 'No git changes detected'}
            except Exception as e:
                logger.warning(f"Failed to get git diff: {e}")
                git_diff_data = {'has_changes': False, 'error': str(e)}
        
        # Perform analysis
        result = ai_service.analyze_code(code, language, explain_level, provider)
        
        if result['success']:
            # Add git diff data to result
            if git_diff_data:
                result['git_diff'] = git_diff_data
            
            # Record usage
            usage_service.record_analysis_usage(session_id)
            
            # Add usage info to response
            usage_info = usage_service.get_usage_info(session_id)
            result['usage_info'] = usage_info
            
            logger.info(f"Code analysis successful for session {session_id}")
        else:
            logger.error(f"Code analysis failed for session {session_id}: {result.get('error')}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Unexpected error in analyze_code endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Analysis failed: {str(e)}'
        }), 500

@api_bp.route('/git/diff', methods=['GET'])
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_git_diff():
    """
    Get current git diff for the repository.
    
    Query parameters:
    - file_path: Optional specific file to diff
    - staged: Whether to get staged changes (default: false)
    
    Returns git diff information with highlighted changes.
    """
    try:
        if not git_service.git_available:
            return jsonify({
                'success': False,
                'error': 'Git is not available on this system'
            }), 503
        
        # Get query parameters
        file_path = request.args.get('file_path')
        staged = request.args.get('staged', 'false').lower() == 'true'
        
        # Get git diff
        diff_result = git_service.get_current_diff(file_path=file_path, staged=staged)
        
        if diff_result.success:
            return jsonify({
                'success': True,
                'git_diff': {
                    'has_changes': diff_result.has_changes,
                    'added_lines': diff_result.added_lines,
                    'removed_lines': diff_result.removed_lines,
                    'diff_lines': [
                        {
                            'line_number': line.line_number,
                            'content': line.content,
                            'type': line.type
                        }
                        for line in diff_result.diff_lines
                    ]
                },
                'file_path': file_path,
                'staged': staged
            })
        else:
            return jsonify({
                'success': False,
                'error': diff_result.error or 'Failed to get git diff'
            }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in get_git_diff endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Git diff failed: {str(e)}'
        }), 500

@api_bp.route('/git/status', methods=['GET'])
@rate_limit(requests_per_minute=60, requests_per_hour=500)
def get_git_status():
    """
    Get git repository status.
    
    Returns information about modified, added, and deleted files.
    """
    try:
        if not git_service.git_available:
            return jsonify({
                'success': False,
                'error': 'Git is not available on this system'
            }), 503
        
        # Check if we're in a git repository
        if not git_service.is_git_repository():
            return jsonify({
                'success': False,
                'error': 'Not in a git repository'
            }), 400
        
        # Get file status
        file_status = git_service.get_file_status()
        
        return jsonify({
            'success': True,
            'git_status': {
                'is_git_repo': True,
                'files': file_status,
                'has_changes': len(file_status) > 0
            }
        })
        
    except Exception as e:
        logger.error(f"Unexpected error in get_git_status endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Git status failed: {str(e)}'
        }), 500

@api_bp.route('/generate', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def generate_code():
    """
    Generate code using GPT API.
    
    Expected JSON payload:
    {
        "prompt": "Create a function to calculate fibonacci numbers",
        "language": "python",
        "explain_level": "medium"
    }
    
    Returns generated code with explanations.
    """
    try:
        # Validate request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Empty request body'
            }), 400
        
        # Validate required fields
        prompt = data.get('prompt', '').strip()
        language = data.get('language', '').strip()
        explain_level = data.get('explain_level', 'medium').strip()
        
        if not prompt:
            return jsonify({
                'success': False,
                'error': 'Prompt is required'
            }), 400
        
        if not language:
            return jsonify({
                'success': False,
                'error': 'Language is required'
            }), 400
        
        if explain_level not in ['short', 'medium', 'long']:
            explain_level = 'medium'
        
        # Check usage limits
        session_id = usage_service.get_session_id()
        can_use, message = usage_service.can_use_analysis(session_id)
        
        if not can_use:
            usage_info = usage_service.get_usage_info(session_id)
            return jsonify({
                'success': False,
                'error': message,
                'usage_info': usage_info
            }), 403
        
        # Get AI provider preference
        provider = data.get('provider')  # Optional provider selection
        
        # Check if AI service is available and configured
        if ai_service is None or not ai_service.is_any_provider_configured():
            available_providers = ai_service.get_available_providers() if ai_service else {}
            return jsonify({
                'success': False,
                'error': 'AI code generation service not configured. Please contact administrator.',
                'available_providers': available_providers
            }), 503
        
        # Generate code
        result = ai_service.generate_code(prompt, language, explain_level, provider)
        
        if result['success']:
            # Record usage
            usage_service.record_generation_usage(session_id)
            
            # Add usage info to response
            usage_info = usage_service.get_usage_info(session_id)
            result['usage_info'] = usage_info
            
            logger.info(f"Code generation successful for session {session_id}")
        else:
            logger.error(f"Code generation failed for session {session_id}: {result.get('error')}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Unexpected error in generate_code endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Code generation failed: {str(e)}'
        }), 500

@api_bp.route('/ai/providers')
def get_ai_providers():
    """Get available AI providers and their configuration status."""
    try:
        if ai_service is None:
            return jsonify({
                'success': False,
                'error': 'AI services not available',
                'providers': {},
                'configured_providers': [],
                'has_any_configured': False
            })
        
        providers = ai_service.get_available_providers()
        configured_providers = ai_service.get_configured_providers()
        
        return jsonify({
            'success': True,
            'providers': providers,
            'configured_providers': configured_providers,
            'has_any_configured': ai_service.is_any_provider_configured()
        })
        
    except Exception as e:
        logger.error(f"Error getting AI providers: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to get AI providers: {str(e)}'
        }), 500

@api_bp.route('/usage')
def get_usage_info():
    """Get usage information for the current session."""
    try:
        session_id = usage_service.get_session_id()
        usage_info = usage_service.get_usage_info(session_id)
        
        return jsonify({
            'success': True,
            'usage_info': usage_info
        })
        
    except Exception as e:
        logger.error(f"Error getting usage info: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to get usage info: {str(e)}'
        }), 500

@api_bp.route('/upgrade', methods=['POST'])
def upgrade_to_premium():
    """Upgrade to premium (placeholder for payment integration)."""
    try:
        session_id = usage_service.get_session_id()
        success = usage_service.upgrade_to_premium(session_id)
        
        if success:
            usage_info = usage_service.get_usage_info(session_id)
            return jsonify({
                'success': True,
                'message': 'Successfully upgraded to premium!',
                'usage_info': usage_info
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to upgrade to premium'
            }), 500
            
    except Exception as e:
        logger.error(f"Error upgrading to premium: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Upgrade failed: {str(e)}'
        }), 500
    

@api_bp.route('/admin/plans', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def get_admin_plans():
    """Admin endpoint to get all subscription plans."""
    try:
        plans = PlanRepository.get_all_plans()
        return jsonify({'success': True, 'plans': [p.to_dict() for p in plans]})
    except Exception as e:
        logger.error(f"Error getting admin plans: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/plans/<int:plan_id>', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def get_admin_plan(plan_id):
    """Admin endpoint to get a single subscription plan."""
    try:
        plan = PlanRepository.get_plan_by_id(plan_id)
        if plan:
            return jsonify({'success': True, 'plan': plan.to_dict()})
        else:
            return jsonify({'success': False, 'error': 'Plan not found'}), 404
    except Exception as e:
        logger.error(f"Error getting admin plan {plan_id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/plans', methods=['POST'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def create_admin_plan():
    """Admin endpoint to create a new subscription plan."""
    try:
        plan_data = request.get_json()
        if not plan_data:
            return jsonify({'success': False, 'error': 'Invalid data'}), 400
        
        plan_id = PlanRepository.create_plan(plan_data)
        if plan_id:
            new_plan = PlanRepository.get_plan_by_id(plan_id)
            return jsonify({'success': True, 'plan': new_plan.to_dict()}), 201
        else:
            return jsonify({'success': False, 'error': 'Failed to create plan'}), 400
    except Exception as e:
        logger.error(f"Error creating admin plan: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/plans/<int:plan_id>', methods=['PUT'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def update_admin_plan(plan_id):
    """Admin endpoint to update a subscription plan."""
    try:
        plan_data = request.get_json()
        if not plan_data:
            return jsonify({'success': False, 'error': 'Invalid data'}), 400
        
        success = PlanRepository.update_plan(plan_id, plan_data)
        if success:
            updated_plan = PlanRepository.get_plan_by_id(plan_id)
            return jsonify({'success': True, 'plan': updated_plan.to_dict()})
        else:
            return jsonify({'success': False, 'error': 'Failed to update plan'}), 400
    except Exception as e:
        logger.error(f"Error updating admin plan {plan_id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/plans/<int:plan_id>/toggle', methods=['POST'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def toggle_admin_plan_status(plan_id):
    """Admin endpoint to toggle a plan's active status."""
    try:
        success = PlanRepository.toggle_plan_status(plan_id)
        if success:
            return jsonify({'success': True, 'message': f'Plan {plan_id} status toggled.'})
        else:
            return jsonify({'success': False, 'error': 'Failed to toggle plan status'}), 400
    except Exception as e:
        logger.error(f"Error toggling plan status for {plan_id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/plans/<int:plan_id>', methods=['DELETE'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def delete_admin_plan(plan_id):
    """Admin endpoint to delete a subscription plan."""
    try:
        success = PlanRepository.delete_plan(plan_id)
        if success:
            return jsonify({'success': True, 'message': f'Plan {plan_id} deleted.'})
        else:
            return jsonify({'success': False, 'error': 'Failed to delete plan'}), 400
    except Exception as e:
        logger.error(f"Error deleting admin plan {plan_id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/plan-distribution', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def get_plan_distribution():
    """Return counts for Basic, Premium, Annual plans."""
    try:
        data = PlanRepository.get_plan_distribution()
        return jsonify({'success': True, 'distribution': data})
    except Exception as e:
        logger.error(f"Error getting plan distribution: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/payment-methods', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def get_payment_methods():
    """Return payment method stats."""
    try:
        data = PaymentRepository.get_payment_method_stats()
        return jsonify({'success': True, 'methods': data})
    except Exception as e:
        logger.error(f"Error getting payment methods: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/subscription-status', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def get_subscription_status():
    """Return subscription status counts."""
    try:
        data = SubscriptionRepository.get_status_counts()
        return jsonify({'success': True, 'status': data})
    except Exception as e:
        logger.error(f"Error getting subscription status: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/recent-activity', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
def get_recent_activity():
    """Return recent subscription/payment actions."""
    try:
        data = ActivityRepository.get_recent_activity(limit=10)
        return jsonify({'success': True, 'activity': data})
    except Exception as e:
        logger.error(f"Error getting recent activity: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500