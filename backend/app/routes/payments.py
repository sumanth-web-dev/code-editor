"""
Payment and subscription API routes.
"""

from flask import Blueprint, request, jsonify
from datetime import date, datetime
from decimal import Decimal
from app.services.auth_service import auth_service
from app.services.payment_service import payment_service
from app.models.user import UserRole
from app.middleware.rate_limiter import rate_limit
from app.database.plan_repository import PlanRepository
import logging

logger = logging.getLogger(__name__)

# Create payments blueprint
payments_bp = Blueprint('payments', __name__)

@payments_bp.route('/plans', methods=['GET'])
@rate_limit(requests_per_minute=60, requests_per_hour=500)
def get_subscription_plans():
    """Get all available subscription plans."""
    try:
        # Get plans from database
        plans = PlanRepository.get_all_plans(active_only=True)
        
        # Convert to API format
        plans_data = []
        for plan in plans:
            plan_dict = plan.to_dict()
            # Ensure ID is string for frontend compatibility
            plan_dict['id'] = str(plan_dict['id'])
            # Add additional fields for frontend compatibility
            plan_type = plan_dict.get('plan_type', 'monthly')
            if plan_type == 'yearly':
                plan_dict['interval'] = 'year'
            elif plan_type == 'monthly':
                plan_dict['interval'] = 'month'
            else:
                plan_dict['interval'] = plan_type.replace('ly', '') if 'ly' in plan_type else plan_type
            
            plan_dict['price'] = float(plan_dict.get('price_per_unit', 0))
            plan_dict['executionLimit'] = plan_dict.get('features', {}).get('execution_limit', 100)
            plan_dict['storageLimit'] = plan_dict.get('features', {}).get('storage_limit', 1024)
            plan_dict['features'] = plan_dict.get('features', {}).get('features', [])
            plans_data.append(plan_dict)
        
        return jsonify({
            'success': True,
            'plans': plans_data,
            'count': len(plans_data)
        })
        
    except Exception as e:
        logger.error(f"Error getting subscription plans: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get subscription plans'
        }), 500

@payments_bp.route('/calculate-cost', methods=['POST'])
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def calculate_subscription_cost():
    """
    Calculate subscription cost.
    
    Expected JSON payload:
    {
        "plan_id": 1,
        "start_date": "2024-01-01",  // optional
        "end_date": "2024-01-31",    // optional for custom plans
        "duration_days": 30          // optional for custom plans
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        plan_id = data.get('plan_id')
        
        if not plan_id:
            return jsonify({
                'success': False,
                'error': 'Plan ID is required'
            }), 400
        
        # Convert plan_id to integer if it's a string
        try:
            plan_id = int(plan_id)
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'error': 'Invalid plan ID format'
            }), 400
        
        # Parse dates
        start_date = None
        end_date = None
        duration_days = data.get('duration_days')
        
        if data.get('start_date'):
            try:
                start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid start_date format. Use YYYY-MM-DD'
                }), 400
        
        if data.get('end_date'):
            try:
                end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid end_date format. Use YYYY-MM-DD'
                }), 400
        
        # Validate date range
        if start_date and end_date and end_date <= start_date:
            return jsonify({
                'success': False,
                'error': 'End date must be after start date'
            }), 400
        
        # Calculate cost
        success, total_cost, error = payment_service.calculate_subscription_cost(
            plan_id=plan_id,
            start_date=start_date,
            end_date=end_date,
            duration_days=duration_days
        )
        
        if success:
            # Calculate duration for display
            if start_date and end_date:
                calculated_duration = (end_date - start_date).days + 1
            elif duration_days:
                calculated_duration = duration_days
            else:
                # Get plan default duration
                plans = {plan.id: plan for plan in payment_service.get_available_plans()}
                plan = plans.get(plan_id)
                calculated_duration = plan.get_duration_days() if plan else 0
            
            return jsonify({
                'success': True,
                'cost_calculation': {
                    'plan_id': plan_id,
                    'total_cost': float(total_cost),
                    'currency': 'USD',
                    'duration_days': calculated_duration,
                    'start_date': start_date.isoformat() if start_date else None,
                    'end_date': end_date.isoformat() if end_date else None
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': error
            }), 400
            
    except Exception as e:
        logger.error(f"Error calculating subscription cost: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Cost calculation failed'
        }), 500

@payments_bp.route('/create-subscription', methods=['POST'])
@auth_service.require_auth()
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def create_subscription():
    """
    Create a new subscription and payment.
    
    Expected JSON payload:
    {
        "plan_id": 1,
        "start_date": "2024-01-01",  // optional
        "end_date": "2024-01-31",    // optional for custom plans
        "duration_days": 30,         // optional for custom plans
        "payment_gateway": "stripe"  // optional, defaults to configured gateway
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        user_data = request.current_user
        plan_id = data.get('plan_id')
        
        if not plan_id:
            return jsonify({
                'success': False,
                'error': 'Plan ID is required'
            }), 400
        
        # Convert plan_id to integer if it's a string
        try:
            plan_id = int(plan_id)
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'error': 'Invalid plan ID format'
            }), 400
        
        # Parse dates
        start_date = None
        end_date = None
        duration_days = data.get('duration_days')
        gateway = data.get('payment_gateway')
        
        if data.get('start_date'):
            try:
                start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid start_date format. Use YYYY-MM-DD'
                }), 400
        
        if data.get('end_date'):
            try:
                end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': 'Invalid end_date format. Use YYYY-MM-DD'
                }), 400
        
        # Create mock user object (in real implementation, fetch from database)
        from app.models.user import User, UserRole
        user = User(
            id=user_data['user_id'],
            email=user_data['email'],
            role=UserRole(user_data['role'])
        )
        
        # Create subscription and payment
        success, payment_data, error = payment_service.create_subscription_payment(
            user=user,
            plan_id=plan_id,
            start_date=start_date,
            end_date=end_date,
            duration_days=duration_days,
            gateway=gateway
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Subscription created successfully',
                'data': payment_data
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': error
            }), 400
            
    except Exception as e:
        logger.error(f"Error creating subscription: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Subscription creation failed'
        }), 500

@payments_bp.route('/confirm-payment', methods=['POST'])
@auth_service.require_auth()
@rate_limit(requests_per_minute=20, requests_per_hour=100)
def confirm_payment():
    """
    Confirm a payment and activate subscription.
    
    Expected JSON payload:
    {
        "payment_id": 123,
        "gateway_transaction_id": "pi_1234567890"  // optional
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        payment_id = data.get('payment_id')
        gateway_transaction_id = data.get('gateway_transaction_id')
        
        if not payment_id:
            return jsonify({
                'success': False,
                'error': 'Payment ID is required'
            }), 400
        
        # Confirm payment
        success, message = payment_service.confirm_payment(
            payment_id=payment_id,
            gateway_transaction_id=gateway_transaction_id
        )
        
        if success:
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
        logger.error(f"Error confirming payment: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Payment confirmation failed'
        }), 500

@payments_bp.route('/my-subscriptions', methods=['GET'])
@auth_service.require_auth()
@rate_limit(requests_per_minute=30, requests_per_hour=200)
def get_my_subscriptions():
    """Get current user's subscriptions."""
    try:
        user_data = request.current_user
        user_id = user_data['user_id']
        
        subscriptions = payment_service.get_user_subscriptions(user_id)
        active_subscription = payment_service.get_active_subscription(user_id)
        
        return jsonify({
            'success': True,
            'subscriptions': [sub.to_dict() for sub in subscriptions],
            'active_subscription': active_subscription.to_dict() if active_subscription else None,
            'count': len(subscriptions)
        })
        
    except Exception as e:
        logger.error(f"Error getting user subscriptions: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get subscriptions'
        }), 500

@payments_bp.route('/cancel-subscription', methods=['POST'])
@auth_service.require_auth()
@rate_limit(requests_per_minute=10, requests_per_hour=20)
def cancel_subscription():
    """
    Cancel a subscription.
    
    Expected JSON payload:
    {
        "subscription_id": 123,
        "reason": "No longer needed"  // optional
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        subscription_id = data.get('subscription_id')
        reason = data.get('reason')
        
        if not subscription_id:
            return jsonify({
                'success': False,
                'error': 'Subscription ID is required'
            }), 400
        
        # Cancel subscription
        success, message = payment_service.cancel_subscription(
            subscription_id=subscription_id,
            reason=reason
        )
        
        if success:
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
            'error': 'Subscription cancellation failed'
        }), 500

@payments_bp.route('/webhook/<gateway>', methods=['POST'])
@rate_limit(requests_per_minute=100, requests_per_hour=1000)
def payment_webhook(gateway):
    """
    Handle payment gateway webhooks.
    
    This endpoint receives notifications from payment gateways
    about payment status changes.
    """
    try:
        if gateway not in ['stripe', 'razorpay', 'paypal']:
            return jsonify({
                'success': False,
                'error': 'Unsupported gateway'
            }), 400
        
        # Get raw request data
        payload = request.get_data()
        signature = request.headers.get('Stripe-Signature') or request.headers.get('X-Razorpay-Signature')
        
        # In a real implementation, verify webhook signature and process the event
        # For now, just log the webhook
        logger.info(f"Received {gateway} webhook: {len(payload)} bytes")
        
        # Process webhook based on gateway
        if gateway == 'stripe':
            # Handle Stripe webhook
            # Verify signature, parse event, update payment status
            pass
        elif gateway == 'razorpay':
            # Handle Razorpay webhook
            # Verify signature, parse event, update payment status
            pass
        elif gateway == 'paypal':
            # Handle PayPal webhook
            # Verify signature, parse event, update payment status
            pass
        
        return jsonify({
            'success': True,
            'message': 'Webhook processed'
        })
        
    except Exception as e:
        logger.error(f"Error processing {gateway} webhook: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Webhook processing failed'
        }), 500