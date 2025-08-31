"""
Subscription and payment models for the payment system.
"""

from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
from decimal import Decimal
import json

class PlanType(Enum):
    DAILY = "daily"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CUSTOM = "custom"

class SubscriptionStatus(Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"

class PaymentStatus(Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"

@dataclass
class SubscriptionPlan:
    """Subscription plan model."""
    id: Optional[int] = None
    name: str = ""
    description: str = ""
    plan_type: PlanType = PlanType.MONTHLY
    price_per_unit: Decimal = Decimal('0.00')
    currency: str = "USD"
    features: Optional[Dict[str, Any]] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.features is None:
            self.features = {}
    
    def calculate_price(self, duration_days: int = None) -> Decimal:
        """Calculate price based on plan type and duration."""
        if self.plan_type == PlanType.DAILY:
            return self.price_per_unit * (duration_days or 1)
        elif self.plan_type == PlanType.MONTHLY:
            return self.price_per_unit
        elif self.plan_type == PlanType.YEARLY:
            return self.price_per_unit
        elif self.plan_type == PlanType.CUSTOM:
            return self.price_per_unit * (duration_days or 1)
        return self.price_per_unit
    
    def get_duration_days(self, custom_days: int = None) -> int:
        """Get duration in days based on plan type."""
        if self.plan_type == PlanType.DAILY:
            return 1
        elif self.plan_type == PlanType.MONTHLY:
            return 30
        elif self.plan_type == PlanType.YEARLY:
            return 365
        elif self.plan_type == PlanType.CUSTOM:
            return custom_days or 1
        return 30
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert plan to dictionary representation."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'plan_type': self.plan_type.value if isinstance(self.plan_type, PlanType) else self.plan_type,
            'price_per_unit': float(self.price_per_unit),
            'currency': self.currency,
            # Parse features from JSON string to ensure it's always a list
            'features': json.loads(self.features) if isinstance(self.features, str) else [],
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

@dataclass
class UserSubscription:
    """User subscription model."""
    id: Optional[int] = None
    user_id: int = 0
    plan_id: int = 0
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    auto_renew: bool = False
    custom_duration_days: Optional[int] = None
    total_amount: Decimal = Decimal('0.00')
    currency: str = "USD"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    
    # Related objects (loaded separately)
    plan: Optional[SubscriptionPlan] = None
    
    @classmethod
    def create_subscription(cls, user_id: int, plan: SubscriptionPlan, 
                          start_date: date = None, custom_duration_days: int = None) -> 'UserSubscription':
        """Create a new user subscription."""
        if start_date is None:
            start_date = date.today()
        
        duration_days = plan.get_duration_days(custom_duration_days)
        end_date = start_date + timedelta(days=duration_days)
        total_amount = plan.calculate_price(custom_duration_days)
        
        return cls(
            user_id=user_id,
            plan_id=plan.id,
            start_date=start_date,
            end_date=end_date,
            custom_duration_days=custom_duration_days,
            total_amount=total_amount,
            currency=plan.currency,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            plan=plan
        )
    
    def is_active(self) -> bool:
        """Check if subscription is currently active."""
        today = date.today()
        return (self.status == SubscriptionStatus.ACTIVE and 
                self.start_date <= today <= self.end_date)
    
    def is_expired(self) -> bool:
        """Check if subscription is expired."""
        return date.today() > self.end_date
    
    def days_remaining(self) -> int:
        """Get number of days remaining in subscription."""
        if self.is_expired():
            return 0
        return (self.end_date - date.today()).days
    
    def cancel(self, reason: str = None):
        """Cancel the subscription."""
        self.status = SubscriptionStatus.CANCELLED
        self.cancelled_at = datetime.utcnow()
        self.cancellation_reason = reason
        self.updated_at = datetime.utcnow()
        self.auto_renew = False
    
    def extend(self, days: int):
        """Extend subscription by specified days."""
        self.end_date += timedelta(days=days)
        self.updated_at = datetime.utcnow()
        if self.is_expired():
            self.status = SubscriptionStatus.ACTIVE
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert subscription to dictionary representation."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'plan_id': self.plan_id,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status.value if isinstance(self.status, SubscriptionStatus) else self.status,
            'auto_renew': self.auto_renew,
            'custom_duration_days': self.custom_duration_days,
            'total_amount': float(self.total_amount),
            'currency': self.currency,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'cancellation_reason': self.cancellation_reason,
            'is_active': self.is_active(),
            'is_expired': self.is_expired(),
            'days_remaining': self.days_remaining(),
            'plan': self.plan.to_dict() if self.plan else None
        }

@dataclass
class Payment:
    """Payment model for transaction records."""
    id: Optional[int] = None
    user_id: int = 0
    subscription_id: Optional[int] = None
    payment_gateway: str = ""
    gateway_transaction_id: Optional[str] = None
    gateway_payment_intent_id: Optional[str] = None
    amount: Decimal = Decimal('0.00')
    currency: str = "USD"
    status: PaymentStatus = PaymentStatus.PENDING
    payment_method: Optional[str] = None
    gateway_response: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_reason: Optional[str] = None
    
    # Related objects (loaded separately)
    subscription: Optional[UserSubscription] = None
    
    @classmethod
    def create_payment(cls, user_id: int, subscription_id: int, amount: Decimal, 
                      currency: str, payment_gateway: str) -> 'Payment':
        """Create a new payment record."""
        return cls(
            user_id=user_id,
            subscription_id=subscription_id,
            amount=amount,
            currency=currency,
            payment_gateway=payment_gateway,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    def mark_completed(self, gateway_transaction_id: str, gateway_response: Dict[str, Any] = None):
        """Mark payment as completed."""
        self.status = PaymentStatus.COMPLETED
        self.gateway_transaction_id = gateway_transaction_id
        self.gateway_response = gateway_response or {}
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def mark_failed(self, reason: str, gateway_response: Dict[str, Any] = None):
        """Mark payment as failed."""
        self.status = PaymentStatus.FAILED
        self.failed_reason = reason
        self.gateway_response = gateway_response or {}
        self.updated_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert payment to dictionary representation."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'subscription_id': self.subscription_id,
            'payment_gateway': self.payment_gateway,
            'gateway_transaction_id': self.gateway_transaction_id,
            'gateway_payment_intent_id': self.gateway_payment_intent_id,
            'amount': float(self.amount),
            'currency': self.currency,
            'status': self.status.value if isinstance(self.status, PaymentStatus) else self.status,
            'payment_method': self.payment_method,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'failed_reason': self.failed_reason,
            'subscription': self.subscription.to_dict() if self.subscription else None
        }

@dataclass
class UsageLog:
    """Usage tracking model for analytics and limits."""
    id: Optional[int] = None
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    action_type: str = ""  # code_execution, ai_analysis, ai_generation
    language: Optional[str] = None
    execution_time_ms: Optional[int] = None
    success: bool = True
    error_message: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None
    
    @classmethod
    def create_log(cls, user_id: int = None, session_id: str = None, 
                  action_type: str = "", language: str = None, 
                  execution_time_ms: int = None, success: bool = True,
                  error_message: str = None, ip_address: str = None) -> 'UsageLog':
        """Create a new usage log entry."""
        return cls(
            user_id=user_id,
            session_id=session_id,
            action_type=action_type,
            language=language,
            execution_time_ms=execution_time_ms,
            success=success,
            error_message=error_message,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert usage log to dictionary representation."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'session_id': self.session_id,
            'action_type': self.action_type,
            'language': self.language,
            'execution_time_ms': self.execution_time_ms,
            'success': self.success,
            'error_message': self.error_message,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

@dataclass
class AuditLog:
    """Audit log model for admin actions."""
    id: Optional[int] = None
    admin_user_id: Optional[int] = None
    action: str = ""
    target_type: Optional[str] = None  # user, subscription, payment
    target_id: Optional[int] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None
    
    @classmethod
    def create_log(cls, admin_user_id: int, action: str, target_type: str = None,
                  target_id: int = None, old_values: Dict[str, Any] = None,
                  new_values: Dict[str, Any] = None, ip_address: str = None) -> 'AuditLog':
        """Create a new audit log entry."""
        return cls(
            admin_user_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            old_values=old_values or {},
            new_values=new_values or {},
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert audit log to dictionary representation."""
        return {
            'id': self.id,
            'admin_user_id': self.admin_user_id,
            'action': self.action,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'old_values': self.old_values or {},
            'new_values': self.new_values or {},
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }