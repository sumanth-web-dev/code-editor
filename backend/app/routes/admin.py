"""
Admin panel API routes.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from decimal import Decimal
from app.services.auth_service import auth_service
from app.services.payment_service import payment_service
from app.services.admin_service import admin_service
from app.models.user import UserRole
from app.models.subscription import SubscriptionStatus, PaymentStatus
from app.middleware.rate_limiter import rate_limit
from app.database.plan_repository import PlanRepository
import logging
from functools import wraps

logger = logging.getLogger(__name__)

# Create admin blueprint
admin_bp = Blueprint('admin', __name__)

def handle_admin_auth_error(f):
    """Decorator to handle authentication errors in admin routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            if "token" in str(e).lower() and "expire" in str(e).lower():
                logger.warning(f"Token expired in admin route: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': 'Authentication token has expired. Please login again.',
                    'error_code': 'TOKEN_EXPIRED'
                }), 401
            raise e
    return decorated_function

@admin_bp.route('/dashboard', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=60, requests_per_hour=500)
def get_dashboard_stats():
    """Get admin dashboard statistics."""
    try:
        stats = admin_service.get_dashboard_stats()
        
        return jsonify({
            'success': True,
            'dashboard': stats
        })
        
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get dashboard statistics'
        }), 500

@admin_bp.route('/users', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_users():
    """
    Get list of users with pagination and filtering.
    
    Query parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)
    - search: Search by name or email
    - role: Filter by role
    - status: Filter by active/inactive
    """
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        search = request.args.get('search', '').strip()
        role_filter = request.args.get('role', '').strip()
        status_filter = request.args.get('status', '').strip()
        
        # Get users from database
        result = admin_service.get_users_list(page, per_page, search, role_filter, status_filter)
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error getting users: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get users'
        }), 500

@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=60, requests_per_hour=300)
def get_user_details(user_id):
    """Get detailed information about a specific user."""
    try:
        # In a real implementation, fetch user from database
        # For now, return mock data
        
        user_details = {
            'id': user_id,
            'email': 'john@example.com',
            'first_name': 'John',
            'last_name': 'Doe',
            'role': 'student',
            'is_active': True,
            'email_verified': True,
            'created_at': '2024-01-15T10:30:00Z',
            'updated_at': '2024-01-18T12:00:00Z',
            'last_login': '2024-01-20T14:45:00Z',
            'phone': '+1234567890',
            'country': 'US',
            'timezone': 'America/New_York',
            'subscriptions': [
                {
                    'id': 1,
                    'plan_name': 'Monthly Pro',
                    'status': 'active',
                    'start_date': '2024-01-15',
                    'end_date': '2024-02-15',
                    'total_amount': 19.99,
                    'auto_renew': True
                }
            ],
            'payments': [
                {
                    'id': 1,
                    'amount': 19.99,
                    'currency': 'USD',
                    'status': 'completed',
                    'payment_gateway': 'stripe',
                    'created_at': '2024-01-15T10:35:00Z',
                    'completed_at': '2024-01-15T10:36:00Z'
                }
            ],
            'usage_stats': {
                'total_executions': 145,
                'total_ai_analyses': 23,
                'favorite_languages': ['python', 'javascript', 'java'],
                'last_activity': '2024-01-20T14:45:00Z'
            }
        }
        
        return jsonify({
            'success': True,
            'user': user_details
        })
        
    except Exception as e:
        logger.error(f"Error getting user details: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get user details'
        }), 500

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=20, requests_per_hour=100)
def update_user(user_id):
    """
    Update user information.
    
    Expected JSON payload:
    {
        "first_name": "John",
        "last_name": "Doe",
        "role": "editor",
        "is_active": true,
        "email_verified": true
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        admin_user = request.current_user
        
        # Validate role if provided
        if 'role' in data:
            try:
                UserRole(data['role'])
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid role'
                }), 400
        
        # Update user in database
        success, message = admin_service.update_user(user_id, data)
        
        if success:
            # Log admin action
            logger.info(f"Admin {admin_user['user_id']} updated user {user_id}")
            
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 400
        
    except Exception as e:
        logger.error(f"Error updating user: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update user'
        }), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def delete_user(user_id):
    """Delete a user (soft delete by deactivating)."""
    try:
        admin_user = request.current_user
        
        # Delete user
        success, message = admin_service.delete_user(user_id)
        
        if success:
            # Log admin action
            logger.info(f"Admin {admin_user['user_id']} deleted user {user_id}")
            
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 400
        
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete user'
        }), 500

@admin_bp.route('/subscriptions', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_subscriptions():
    """
    Get list of subscriptions with pagination and filtering.
    
    Query parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)
    - status: Filter by subscription status
    - plan_id: Filter by plan ID
    - user_email: Filter by user email
    """
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        status_filter = request.args.get('status', '').strip()
        plan_id_filter = request.args.get('plan_id', '').strip()
        user_email_filter = request.args.get('user_email', '').strip()
        
        # Get subscriptions from database
        result = admin_service.get_subscriptions_list(page, per_page, status_filter, plan_id_filter, user_email_filter)
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error getting subscriptions: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get subscriptions'
        }), 500

@admin_bp.route('/subscriptions/<int:subscription_id>/extend', methods=['POST'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=20, requests_per_hour=100)
def extend_subscription(subscription_id):
    """
    Extend a subscription.
    
    Expected JSON payload:
    {
        "days": 30,
        "reason": "Customer service extension"
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        days = data.get('days')
        reason = data.get('reason', '')
        
        if not days or days <= 0:
            return jsonify({
                'success': False,
                'error': 'Valid number of days is required'
            }), 400
        
        admin_user = request.current_user
        
        # Extend subscription
        success, message = admin_service.extend_subscription(subscription_id, days, reason)
        
        if success:
            # Log admin action
            logger.info(f"Admin {admin_user['user_id']} extended subscription {subscription_id} by {days} days. Reason: {reason}")
            
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 400
            
    except Exception as e:
        logger.error(f"Error extending subscription: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to extend subscription'
        }), 500

@admin_bp.route('/subscriptions/<int:subscription_id>/cancel', methods=['POST'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=20, requests_per_hour=100)
def admin_cancel_subscription(subscription_id):
    """
    Cancel a subscription (admin action).
    
    Expected JSON payload:
    {
        "reason": "Policy violation"
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        reason = data.get('reason', 'Cancelled by admin')
        
        admin_user = request.current_user
        
        # Cancel subscription
        success, message = admin_service.cancel_subscription(subscription_id, reason)
        
        if success:
            # Log admin action
            logger.info(f"Admin {admin_user['user_id']} cancelled subscription {subscription_id}. Reason: {reason}")
            
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 400
            
    except Exception as e:
        logger.error(f"Error cancelling subscription: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to cancel subscription'
        }), 500

@admin_bp.route('/payments', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_payments():
    """
    Get list of payments with pagination and filtering.
    
    Query parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 20, max: 100)
    - status: Filter by payment status
    - gateway: Filter by payment gateway
    - date_from: Filter payments from date (YYYY-MM-DD)
    - date_to: Filter payments to date (YYYY-MM-DD)
    - user_email: Filter by user email
    """
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        status_filter = request.args.get('status', '').strip()
        gateway_filter = request.args.get('gateway', '').strip()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        user_email_filter = request.args.get('user_email', '').strip()
        
        # Get payments from database
        result = admin_service.get_payments_list(page, per_page, status_filter, gateway_filter, user_email_filter)
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error getting payments: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get payments'
        }), 500

@admin_bp.route('/payments/<int:payment_id>/refund', methods=['POST'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def refund_payment(payment_id):
    """
    Process a refund for a payment.
    
    Expected JSON payload:
    {
        "amount": 19.99,  // optional, full refund if not specified
        "reason": "Customer request"
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        amount = data.get('amount')
        reason = data.get('reason', 'Refund processed by admin')
        
        if amount is not None:
            amount = Decimal(str(amount))
            if amount <= 0:
                return jsonify({
                    'success': False,
                    'error': 'Refund amount must be positive'
                }), 400
        
        admin_user = request.current_user
        
        # Process refund
        success, message = admin_service.process_refund(payment_id, amount, reason)
        
        if success:
            # Log admin action
            logger.info(f"Admin {admin_user['user_id']} processed refund for payment {payment_id}. Amount: {amount}, Reason: {reason}")
            
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 400
            
    except Exception as e:
        logger.error(f"Error processing refund: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to process refund'
        }), 500

@admin_bp.route('/plans', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=60, requests_per_hour=300)
def get_admin_plans():
    """Get all subscription plans for admin management."""
    try:
        # Get all plans (including inactive) for admin
        plans = PlanRepository.get_all_plans(active_only=False)
        
        # Convert to API format
        plans_data = []
        for plan in plans:
            if plan is None:
                continue
                
            try:
                plan_dict = plan.to_dict()
                # Add additional fields for frontend compatibility
                plan_dict['interval'] = plan_dict.get('plan_type', 'monthly').replace('ly', '')
                plan_dict['price'] = float(plan_dict.get('price_per_unit', 0))
                plan_dict['executionLimit'] = plan_dict.get('features', {}).get('execution_limit', 100)
                plan_dict['storageLimit'] = plan_dict.get('features', {}).get('storage_limit', 1024)
                plan_dict['aiAnalysisLimit'] = plan_dict.get('features', {}).get('ai_analysis_limit', 10)
                plan_dict['features'] = plan_dict.get('features', {}).get('features', [])
                plans_data.append(plan_dict)
            except Exception as e:
                logger.error(f"Error converting plan to dict: {str(e)}")
                continue
        
        return jsonify({
            'success': True,
            'plans': plans_data,
            'count': len(plans_data)
        })
        
    except Exception as e:
        logger.error(f"Error getting admin plans: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get plans'
        }), 500

@admin_bp.route('/plans', methods=['POST'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def create_plan():
    """
    Create a new subscription plan.
    
    Expected JSON payload:
    {
        "name": "Premium Plan",
        "description": "Premium features",
        "price": 19.99,
        "interval": "month",
        "executionLimit": 500,
        "storageLimit": 5120,
        "features": ["feature1", "feature2"],
        "is_active": true
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        admin_user = request.current_user
        
        # Validate required fields
        required_fields = ['name', 'description', 'price', 'interval']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'success': False,
                    'error': f'{field} is required'
                }), 400
        
        # Create plan in database
        plan_id = PlanRepository.create_plan(data)
        
        if plan_id:
            logger.info(f"Admin {admin_user['user_id']} created new plan: {data['name']} (ID: {plan_id})")
            return jsonify({
                'success': True,
                'message': 'Plan created successfully',
                'plan_id': plan_id
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create plan in database'
            }), 500
        
    except Exception as e:
        logger.error(f"Error creating plan: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to create plan'
        }), 500

@admin_bp.route('/plans/<int:plan_id>', methods=['PUT'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=20, requests_per_hour=100)
def update_plan(plan_id):
    """Update an existing subscription plan."""
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        admin_user = request.current_user
        
        # Update plan in database
        success = PlanRepository.update_plan(plan_id, data)
        
        if success:
            logger.info(f"Admin {admin_user['user_id']} updated plan {plan_id}")
            return jsonify({
                'success': True,
                'message': 'Plan updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update plan in database'
            }), 500
        
    except Exception as e:
        logger.error(f"Error updating plan: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update plan'
        }), 500

@admin_bp.route('/plans/<int:plan_id>/toggle', methods=['POST'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=20, requests_per_hour=100)
def toggle_plan_status(plan_id):
    """Toggle plan active/inactive status."""
    try:
        admin_user = request.current_user
        
        # Toggle plan status in database
        success = PlanRepository.toggle_plan_status(plan_id)
        
        if success:
            logger.info(f"Admin {admin_user['user_id']} toggled status for plan {plan_id}")
            return jsonify({
                'success': True,
                'message': 'Plan status updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update plan status in database'
            }), 500
        
    except Exception as e:
        logger.error(f"Error toggling plan status: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to update plan status'
        }), 500

@admin_bp.route('/plans/<int:plan_id>', methods=['DELETE'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=10, requests_per_hour=30)
def delete_plan(plan_id):
    """Delete a subscription plan."""
    try:
        admin_user = request.current_user
        
        # Delete plan from database
        success = PlanRepository.delete_plan(plan_id)
        
        if success:
            logger.info(f"Admin {admin_user['user_id']} deleted plan {plan_id}")
            return jsonify({
                'success': True,
                'message': 'Plan deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete plan from database'
            }), 500
        
    except Exception as e:
        logger.error(f"Error deleting plan: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to delete plan'
        }), 500

@admin_bp.route('/analytics/revenue', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_revenue_analytics():
    """Get comprehensive revenue analytics data with charts."""
    try:
        period = request.args.get('period', 'monthly')
        
        analytics = admin_service.get_revenue_analytics(period)
        
        return jsonify({
            'success': True,
            'analytics': analytics
        })
        
    except Exception as e:
        logger.error(f"Error getting revenue analytics: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get revenue analytics'
        }), 500

@admin_bp.route('/analytics/dashboard', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=60, requests_per_hour=300)
def get_dashboard_analytics():
    """Get comprehensive dashboard analytics with real database values."""
    try:
        # Get enhanced dashboard stats
        stats = admin_service.get_dashboard_stats()
        
        # Get revenue analytics for charts
        revenue_analytics = admin_service.get_revenue_analytics('monthly')
        
        # Combine data for comprehensive dashboard
        dashboard_data = {
            **stats,
            'analytics': revenue_analytics,
            'currency': 'INR'
        }
        
        return jsonify({
            'success': True,
            'dashboard': dashboard_data
        })
        
    except Exception as e:
        logger.error(f"Error getting dashboard analytics: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get dashboard analytics'
        }), 500

@admin_bp.route('/logs', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_system_logs():
    """
    Get system logs with pagination and filtering.
    
    Query parameters:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 50, max: 100)
    - level: Filter by log level (info, warning, error, critical)
    - category: Filter by category (auth, payment, execution, ai_service)
    - hours: Hours to look back (default: 24)
    """
    try:
        from app.database.logs_repository import LogsRepository
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        level = request.args.get('level', '').strip()
        category = request.args.get('category', '').strip()
        hours = int(request.args.get('hours', 24))
        
        # Get logs from database
        result = LogsRepository.get_system_logs(page, per_page, level, category, hours)
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Error getting system logs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get system logs'
        }), 500

@admin_bp.route('/resources', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=60, requests_per_hour=300)
def get_resource_usage():
    """
    Get system resource usage data.
    
    Query parameters:
    - hours: Hours to look back (default: 24)
    """
    try:
        from app.database.logs_repository import LogsRepository
        
        hours = int(request.args.get('hours', 24))
        
        # Get resource usage data
        resource_data = LogsRepository.get_resource_usage(hours)
        
        return jsonify({
            'success': True,
            'resources': resource_data
        })
        
    except Exception as e:
        logger.error(f"Error getting resource usage: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get resource usage'
        }), 500

@admin_bp.route('/logs/summary', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=60, requests_per_hour=300)
def get_logs_summary():
    """Get summary of logs for admin overview."""
    try:
        from app.database.logs_repository import LogsRepository
        
        summary = LogsRepository.get_log_summary()
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        logger.error(f"Error getting logs summary: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get logs summary'
        }), 500

@admin_bp.route('/logs/system', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_system_logs_filtered():
    """
    Get system logs with filtering.
    
    Query parameters:
    - level: Filter by log level
    - category: Filter by category
    - date_from: Start date (YYYY-MM-DD)
    - date_to: End date (YYYY-MM-DD)
    - limit: Number of logs to return (default: 100)
    """
    try:
        from app.database.logs_repository import LogsRepository
        
        level = request.args.get('level', '').strip()
        category = request.args.get('category', '').strip()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        limit = int(request.args.get('limit', 100))
        
        # Get system logs
        logs = LogsRepository.get_system_logs_filtered(level, category, date_from, date_to, limit)
        
        return jsonify({
            'success': True,
            'logs': logs
        })
        
    except Exception as e:
        logger.error(f"Error getting system logs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get system logs'
        }), 500

@admin_bp.route('/logs/audit', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_audit_logs():
    """
    Get audit logs with filtering.
    
    Query parameters:
    - date_from: Start date (YYYY-MM-DD)
    - date_to: End date (YYYY-MM-DD)
    - limit: Number of logs to return (default: 100)
    """
    try:
        from app.database.logs_repository import LogsRepository
        
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        limit = int(request.args.get('limit', 100))
        
        # Get audit logs
        logs = LogsRepository.get_audit_logs_filtered(date_from, date_to, limit)
        
        return jsonify({
            'success': True,
            'logs': logs
        })
        
    except Exception as e:
        logger.error(f"Error getting audit logs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get audit logs'
        }), 500

@admin_bp.route('/resources/usage', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=60, requests_per_hour=300)
def get_resource_usage_data():
    """Get system resource usage data."""
    try:
        from app.database.logs_repository import LogsRepository
        
        # Get resource usage data for the last 24 hours
        usage_data = LogsRepository.get_resource_usage_data()
        
        return jsonify({
            'success': True,
            'usage': usage_data
        })
        
    except Exception as e:
        logger.error(f"Error getting resource usage: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get resource usage'
        }), 500

@admin_bp.route('/logs/<log_type>', methods=['DELETE'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=5, requests_per_hour=20)
def clear_logs(log_type):
    """Clear logs of specified type."""
    try:
        from app.database.logs_repository import LogsRepository
        
        admin_user = request.current_user
        
        if log_type not in ['system-logs', 'audit-logs']:
            return jsonify({
                'success': False,
                'error': 'Invalid log type'
            }), 400
        
        # Clear logs
        success = LogsRepository.clear_logs(log_type)
        
        if success:
            logger.info(f"Admin {admin_user['user_id']} cleared {log_type}")
            return jsonify({
                'success': True,
                'message': f'{log_type.replace("-", " ").title()} cleared successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to clear logs'
            }), 500
        
    except Exception as e:
        logger.error(f"Error clearing logs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to clear logs'
        }), 500

@admin_bp.route('/logs/<log_type>/export', methods=['GET'])
@auth_service.require_auth(required_role=UserRole.ADMIN)
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def export_logs(log_type):
    """Export logs of specified type."""
    try:
        from app.database.logs_repository import LogsRepository
        
        if log_type not in ['system-logs', 'audit-logs']:
            return jsonify({
                'success': False,
                'error': 'Invalid log type'
            }), 400
        
        # Get filters from query parameters
        level = request.args.get('level', '').strip()
        category = request.args.get('category', '').strip()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        limit = int(request.args.get('limit', 1000))
        
        # Export logs
        if log_type == 'system-logs':
            logs = LogsRepository.get_system_logs_filtered(level, category, date_from, date_to, limit)
        else:
            logs = LogsRepository.get_audit_logs_filtered(date_from, date_to, limit)
        
        return jsonify({
            'success': True,
            'data': logs,
            'export_info': {
                'type': log_type,
                'count': len(logs),
                'exported_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error exporting logs: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to export logs'
        }), 500

