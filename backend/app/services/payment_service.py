"""
Payment service for handling subscription payments and integrations.
"""

import stripe
import razorpay
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List, Tuple
from flask import current_app
from app.models.subscription import (
    SubscriptionPlan, UserSubscription, Payment, PaymentStatus, 
    SubscriptionStatus, PlanType
)
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

class PaymentGateway:
    """Base class for payment gateway integrations."""
    
    def create_payment_intent(self, amount: Decimal, currency: str, 
                            metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a payment intent."""
        raise NotImplementedError
    
    def confirm_payment(self, payment_intent_id: str) -> Dict[str, Any]:
        """Confirm a payment."""
        raise NotImplementedError
    
    def refund_payment(self, transaction_id: str, amount: Decimal = None) -> Dict[str, Any]:
        """Refund a payment."""
        raise NotImplementedError

class StripeGateway(PaymentGateway):
    """Stripe payment gateway integration."""
    
    def __init__(self, api_key: str):
        stripe.api_key = api_key
        self.gateway_name = "stripe"
    
    def create_payment_intent(self, amount: Decimal, currency: str, 
                            metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a Stripe payment intent."""
        try:
            # Convert amount to cents (Stripe expects smallest currency unit)
            amount_cents = int(amount * 100)
            
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=currency.lower(),
                metadata=metadata or {},
                automatic_payment_methods={'enabled': True}
            )
            
            return {
                'success': True,
                'payment_intent_id': intent.id,
                'client_secret': intent.client_secret,
                'status': intent.status,
                'gateway_response': intent
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating payment intent: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'gateway_response': {'error': str(e)}
            }
    
    def confirm_payment(self, payment_intent_id: str) -> Dict[str, Any]:
        """Confirm a Stripe payment."""
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            return {
                'success': intent.status == 'succeeded',
                'status': intent.status,
                'transaction_id': intent.id,
                'gateway_response': intent
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error confirming payment: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'gateway_response': {'error': str(e)}
            }
    
    def refund_payment(self, transaction_id: str, amount: Decimal = None) -> Dict[str, Any]:
        """Refund a Stripe payment."""
        try:
            refund_data = {'payment_intent': transaction_id}
            if amount:
                refund_data['amount'] = int(amount * 100)
            
            refund = stripe.Refund.create(**refund_data)
            
            return {
                'success': refund.status == 'succeeded',
                'refund_id': refund.id,
                'status': refund.status,
                'gateway_response': refund
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error processing refund: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'gateway_response': {'error': str(e)}
            }

class RazorpayGateway(PaymentGateway):
    """Razorpay payment gateway integration."""
    
    def __init__(self, key_id: str, key_secret: str):
        self.client = razorpay.Client(auth=(key_id, key_secret))
        self.gateway_name = "razorpay"
    
    def create_payment_intent(self, amount: Decimal, currency: str, 
                            metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a Razorpay order."""
        try:
            # Convert amount to paise (Razorpay expects smallest currency unit)
            amount_paise = int(amount * 100)
            
            order_data = {
                'amount': amount_paise,
                'currency': currency.upper(),
                'notes': metadata or {}
            }
            
            order = self.client.order.create(data=order_data)
            
            return {
                'success': True,
                'payment_intent_id': order['id'],
                'order_id': order['id'],
                'status': order['status'],
                'gateway_response': order
            }
            
        except Exception as e:
            logger.error(f"Razorpay error creating order: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'gateway_response': {'error': str(e)}
            }
    
    def confirm_payment(self, payment_intent_id: str) -> Dict[str, Any]:
        """Confirm a Razorpay payment."""
        try:
            order = self.client.order.fetch(payment_intent_id)
            
            return {
                'success': order['status'] == 'paid',
                'status': order['status'],
                'transaction_id': payment_intent_id,
                'gateway_response': order
            }
            
        except Exception as e:
            logger.error(f"Razorpay error confirming payment: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'gateway_response': {'error': str(e)}
            }
    
    def refund_payment(self, transaction_id: str, amount: Decimal = None) -> Dict[str, Any]:
        """Refund a Razorpay payment."""
        try:
            refund_data = {}
            if amount:
                refund_data['amount'] = int(amount * 100)
            
            refund = self.client.payment.refund(transaction_id, refund_data)
            
            return {
                'success': refund['status'] == 'processed',
                'refund_id': refund['id'],
                'status': refund['status'],
                'gateway_response': refund
            }
            
        except Exception as e:
            logger.error(f"Razorpay error processing refund: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'gateway_response': {'error': str(e)}
            }

class PaymentService:
    """Service for handling subscription payments."""
    
    def __init__(self):
        self.gateways = {}
        self.default_gateway = None
    
    def initialize(self, app):
        """Initialize payment service with Flask app configuration."""
        # Initialize Stripe
        stripe_key = app.config.get('STRIPE_SECRET_KEY')
        if stripe_key:
            self.gateways['stripe'] = StripeGateway(stripe_key)
            if not self.default_gateway:
                self.default_gateway = 'stripe'
        
        # Initialize Razorpay
        razorpay_key_id = app.config.get('RAZORPAY_KEY_ID')
        razorpay_key_secret = app.config.get('RAZORPAY_KEY_SECRET')
        if razorpay_key_id and razorpay_key_secret:
            self.gateways['razorpay'] = RazorpayGateway(razorpay_key_id, razorpay_key_secret)
            if not self.default_gateway:
                self.default_gateway = 'razorpay'
        
        if not self.gateways:
            logger.warning("No payment gateways configured")
    
    def get_available_plans(self) -> List[SubscriptionPlan]:
        """Get all available subscription plans."""
        try:
            from app.database.plan_repository import PlanRepository
            return PlanRepository.get_all_plans(active_only=True)
        except Exception as e:
            logger.error(f"Error fetching plans from database: {str(e)}")
            # Fallback to mock data if database is not available
            return [
                SubscriptionPlan(
                    id=1,
                    name="Basic",
                    description="Basic plan with limited features",
                    plan_type=PlanType.MONTHLY,
                    price_per_unit=Decimal('9.99'),
                    features={
                        "features": ["Code execution", "Basic support"]
                    }
                ),
                SubscriptionPlan(
                    id=2,
                    name="Premium",
                    description="Premium plan with all features",
                    plan_type=PlanType.MONTHLY,
                    price_per_unit=Decimal('19.99'),
                    features={
                        "features": ["Code execution", "AI analysis", "Priority support"]
                    }
                ),
                SubscriptionPlan(
                    id=3,
                    name="Annual",
                    description="Annual plan with discount",
                    plan_type=PlanType.YEARLY,
                    price_per_unit=Decimal('199.99'),
                    features={
                        "features": ["Code execution", "AI analysis", "Priority support", "Advanced features"]
                    }
                )
            ]
    
    def calculate_subscription_cost(self, plan_id: int, start_date: date = None, 
                                  end_date: date = None, duration_days: int = None) -> Tuple[bool, Decimal, str]:
        """
        Calculate the cost of a subscription.
        
        Returns:
            Tuple of (success, total_cost, error_message)
        """
        try:
            # Get plan (in real implementation, fetch from database)
            plans = {plan.id: plan for plan in self.get_available_plans()}
            plan = plans.get(plan_id)
            
            # Also try string version of plan_id for compatibility
            if not plan:
                plan = plans.get(str(plan_id))
            
            if not plan:
                return False, Decimal('0'), f"Plan not found. Available plan IDs: {list(plans.keys())}"
            
            if not plan.is_active:
                return False, Decimal('0'), "Plan is not available"
            
            # Calculate duration and cost
            if plan.plan_type == PlanType.CUSTOM:
                if duration_days:
                    cost = plan.calculate_price(duration_days)
                elif start_date and end_date:
                    duration_days = (end_date - start_date).days + 1
                    cost = plan.calculate_price(duration_days)
                else:
                    return False, Decimal('0'), "Duration or dates required for custom plan"
            else:
                cost = plan.calculate_price()
            
            return True, cost, ""
            
        except Exception as e:
            logger.error(f"Error calculating subscription cost: {str(e)}")
            return False, Decimal('0'), f"Cost calculation failed: {str(e)}"
    
    def create_subscription_payment(self, user: User, plan_id: int, 
                                  start_date: date = None, end_date: date = None,
                                  duration_days: int = None, gateway: str = None) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """
        Create a payment for a subscription.
        
        Returns:
            Tuple of (success, payment_data, error_message)
        """
        try:
            # Calculate cost
            success, total_cost, error = self.calculate_subscription_cost(
                plan_id, start_date, end_date, duration_days
            )
            if not success:
                return False, None, error
            
            # Get gateway
            gateway_name = gateway or self.default_gateway
            if not gateway_name or gateway_name not in self.gateways:
                return False, None, "Payment gateway not available"
            
            payment_gateway = self.gateways[gateway_name]
            
            # Create subscription record (in real implementation, save to database)
            plans = {plan.id: plan for plan in self.get_available_plans()}
            plan = plans.get(plan_id) or plans.get(str(plan_id))
            
            subscription = UserSubscription.create_subscription(
                user_id=user.id,
                plan=plan,
                start_date=start_date or date.today(),
                custom_duration_days=duration_days
            )
            
            # Create payment record
            payment = Payment.create_payment(
                user_id=user.id,
                subscription_id=subscription.id,
                amount=total_cost,
                currency="USD",
                payment_gateway=gateway_name
            )
            
            # Create payment intent with gateway
            metadata = {
                'user_id': str(user.id),
                'subscription_id': str(subscription.id),
                'plan_id': str(plan_id),
                'user_email': user.email
            }
            
            gateway_result = payment_gateway.create_payment_intent(
                amount=total_cost,
                currency="USD",
                metadata=metadata
            )
            
            if not gateway_result['success']:
                return False, None, f"Payment gateway error: {gateway_result.get('error', 'Unknown error')}"
            
            # Update payment with gateway response
            payment.gateway_payment_intent_id = gateway_result['payment_intent_id']
            payment.gateway_response = gateway_result.get('gateway_response', {})
            
            # In real implementation, save payment and subscription to database
            
            return True, {
                'subscription': subscription.to_dict(),
                'payment': payment.to_dict(),
                'gateway_data': {
                    'payment_intent_id': gateway_result['payment_intent_id'],
                    'client_secret': gateway_result.get('client_secret'),
                    'gateway': gateway_name
                }
            }, ""
            
        except Exception as e:
            logger.error(f"Error creating subscription payment: {str(e)}")
            return False, None, f"Payment creation failed: {str(e)}"
    
    def confirm_payment(self, payment_id: int, gateway_transaction_id: str = None) -> Tuple[bool, str]:
        """
        Confirm a payment and activate subscription.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            # In real implementation, fetch payment from database
            payment = None  # This would be fetched from database
            
            if not payment:
                return False, "Payment not found"
            
            if payment.status == PaymentStatus.COMPLETED:
                return True, "Payment already confirmed"
            
            # Get gateway
            gateway = self.gateways.get(payment.payment_gateway)
            if not gateway:
                return False, "Payment gateway not available"
            
            # Confirm with gateway
            gateway_result = gateway.confirm_payment(payment.gateway_payment_intent_id)
            
            if gateway_result['success']:
                # Mark payment as completed
                payment.mark_completed(
                    gateway_transaction_id or gateway_result['transaction_id'],
                    gateway_result.get('gateway_response', {})
                )
                
                # Activate subscription
                # In real implementation, fetch and update subscription
                subscription = None  # This would be fetched from database
                if subscription:
                    subscription.status = SubscriptionStatus.ACTIVE
                    subscription.updated_at = datetime.utcnow()
                
                # In real implementation, save changes to database
                
                logger.info(f"Payment confirmed successfully: {payment_id}")
                return True, "Payment confirmed and subscription activated"
            else:
                # Mark payment as failed
                payment.mark_failed(
                    gateway_result.get('error', 'Payment confirmation failed'),
                    gateway_result.get('gateway_response', {})
                )
                
                # In real implementation, save changes to database
                
                return False, f"Payment confirmation failed: {gateway_result.get('error', 'Unknown error')}"
            
        except Exception as e:
            logger.error(f"Error confirming payment: {str(e)}")
            return False, f"Payment confirmation failed: {str(e)}"
    
    def get_user_subscriptions(self, user_id: int) -> List[UserSubscription]:
        """Get all subscriptions for a user."""
        # In real implementation, fetch from database
        return []
    
    def get_active_subscription(self, user_id: int) -> Optional[UserSubscription]:
        """Get the active subscription for a user."""
        subscriptions = self.get_user_subscriptions(user_id)
        for subscription in subscriptions:
            if subscription.is_active():
                return subscription
        return None
    
    def cancel_subscription(self, subscription_id: int, reason: str = None) -> Tuple[bool, str]:
        """
        Cancel a subscription.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            # In real implementation, fetch subscription from database
            subscription = None  # This would be fetched from database
            
            if not subscription:
                return False, "Subscription not found"
            
            if subscription.status == SubscriptionStatus.CANCELLED:
                return True, "Subscription already cancelled"
            
            # Cancel subscription
            subscription.cancel(reason)
            
            # In real implementation, save changes to database
            
            logger.info(f"Subscription cancelled: {subscription_id}")
            return True, "Subscription cancelled successfully"
            
        except Exception as e:
            logger.error(f"Error cancelling subscription: {str(e)}")
            return False, f"Subscription cancellation failed: {str(e)}"
    
    def extend_subscription(self, subscription_id: int, days: int) -> Tuple[bool, str]:
        """
        Extend a subscription by specified days.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            # In real implementation, fetch subscription from database
            subscription = None  # This would be fetched from database
            
            if not subscription:
                return False, "Subscription not found"
            
            # Extend subscription
            subscription.extend(days)
            
            # In real implementation, save changes to database
            
            logger.info(f"Subscription extended: {subscription_id} by {days} days")
            return True, f"Subscription extended by {days} days"
            
        except Exception as e:
            logger.error(f"Error extending subscription: {str(e)}")
            return False, f"Subscription extension failed: {str(e)}"
    
    def process_refund(self, payment_id: int, amount: Decimal = None, reason: str = None) -> Tuple[bool, str]:
        """
        Process a refund for a payment.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            # In real implementation, fetch payment from database
            payment = None  # This would be fetched from database
            
            if not payment:
                return False, "Payment not found"
            
            if payment.status != PaymentStatus.COMPLETED:
                return False, "Payment is not eligible for refund"
            
            # Get gateway
            gateway = self.gateways.get(payment.payment_gateway)
            if not gateway:
                return False, "Payment gateway not available"
            
            # Process refund with gateway
            gateway_result = gateway.refund_payment(
                payment.gateway_transaction_id,
                amount
            )
            
            if gateway_result['success']:
                # Update payment status
                payment.status = PaymentStatus.REFUNDED
                payment.gateway_response = gateway_result.get('gateway_response', {})
                payment.updated_at = datetime.utcnow()
                
                # In real implementation, save changes to database
                
                logger.info(f"Refund processed successfully: {payment_id}")
                return True, "Refund processed successfully"
            else:
                return False, f"Refund failed: {gateway_result.get('error', 'Unknown error')}"
            
        except Exception as e:
            logger.error(f"Error processing refund: {str(e)}")
            return False, f"Refund processing failed: {str(e)}"

# Global payment service instance
payment_service = PaymentService()