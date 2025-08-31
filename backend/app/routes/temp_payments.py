"""
Temporary payment routes for frontend development.
This provides mock data without authentication requirements.
"""

from flask import Blueprint, jsonify
from app.middleware.rate_limiter import rate_limit
import logging

logger = logging.getLogger(__name__)

# Create temporary payments blueprint
temp_payments_bp = Blueprint('temp_payments', __name__)

@temp_payments_bp.route('/plans', methods=['GET'])
@rate_limit(requests_per_minute=60, requests_per_hour=500)
def get_subscription_plans():
    """Get mock subscription plans for development."""
    try:
        # Mock subscription plans
        mock_plans = [
            {
                "id": 1,
                "name": "Basic",
                "description": "Basic plan with limited features",
                "price": 9.99,
                "currency": "USD",
                "duration_days": 30,
                "plan_type": "monthly",
                "features": ["Code execution", "Basic support"],
                "is_active": True
            },
            {
                "id": 2,
                "name": "Premium",
                "description": "Premium plan with all features",
                "price": 19.99,
                "currency": "USD",
                "duration_days": 30,
                "plan_type": "monthly",
                "features": ["Code execution", "AI analysis", "Priority support"],
                "is_active": True
            },
            {
                "id": 3,
                "name": "Annual",
                "description": "Annual plan with discount",
                "price": 199.99,
                "currency": "USD",
                "duration_days": 365,
                "plan_type": "yearly",
                "features": ["Code execution", "AI analysis", "Priority support", "Advanced features"],
                "is_active": True
            }
        ]
        
        return jsonify({
            'success': True,
            'plans': mock_plans,
            'count': len(mock_plans)
        })
        
    except Exception as e:
        logger.error(f"Error getting subscription plans: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get subscription plans'
        }), 500

@temp_payments_bp.route('/calculate-cost', methods=['POST'])
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def calculate_subscription_cost():
    """Mock cost calculation."""
    try:
        return jsonify({
            'success': True,
            'cost_calculation': {
                'plan_id': 1,
                'total_cost': 9.99,
                'currency': 'USD',
                'duration_days': 30,
                'start_date': None,
                'end_date': None
            }
        })
        
    except Exception as e:
        logger.error(f"Error calculating subscription cost: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Cost calculation failed'
        }), 500

@temp_payments_bp.route('/create-subscription', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def create_subscription():
    """Mock subscription creation."""
    try:
        return jsonify({
            'success': True,
            'message': 'Subscription created successfully (mock)',
            'data': {
                'subscription_id': 123,
                'payment_id': 456,
                'status': 'pending',
                'payment_url': 'https://mock-payment-gateway.com/pay/123'
            }
        })
        
    except Exception as e:
        logger.error(f"Error creating subscription: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Subscription creation failed'
        }), 500

@temp_payments_bp.route('/my-subscriptions', methods=['GET'])
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_my_subscriptions():
    """Mock user subscriptions."""
    try:
        return jsonify({
            'success': True,
            'subscriptions': [],
            'active_subscription': None,
            'count': 0
        })
        
    except Exception as e:
        logger.error(f"Error getting user subscriptions: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get subscriptions'
        }), 500