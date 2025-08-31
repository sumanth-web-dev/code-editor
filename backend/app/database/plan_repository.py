"""
Repository for subscription plan database operations.
"""

import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.database.connection import get_db_connection
from app.models.subscription import SubscriptionPlan, PlanType
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

class PlanRepository:
    @staticmethod
    def ensure_default_free_plan():
        """Ensure the default free plan exists in the database."""
        plans = PlanRepository.get_all_plans()
        for plan in plans:
            if plan.name.lower() == 'free trial':
                return  # Already exists

        # Create default free plan
        default_plan = {
            'name': 'Free Trial',
            'description': '5 free AI analysis and code generation requests per day. Resets at midnight IST.',
            'price': 0,
            'currency': 'INR',
            'interval': 'day',
            'executionLimit': 5,
            'aiAnalysisLimit': 5,
            'features': ['ai_analysis', 'code_generation'],
            'is_active': True
        }
        PlanRepository.create_plan(default_plan)
    """Repository for subscription plan operations."""
    
    @staticmethod
    def get_all_plans(active_only: bool = False) -> List[SubscriptionPlan]:
        """Get all subscription plans."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                query = "SELECT * FROM subscription_plans"
                if active_only:
                    query += " WHERE is_active = 1"
                query += " ORDER BY price ASC"
                
                cursor.execute(query)
                rows = cursor.fetchall()
                
                plans = []
                for row in rows:
                    plan = PlanRepository._row_to_plan(row)
                    plans.append(plan)
                
                return plans
                
        except Exception as e:
            logger.error(f"Error getting plans: {str(e)}")
            return []
    
    @staticmethod
    def get_plan_by_id(plan_id: int) -> Optional[SubscriptionPlan]:
        """Get a plan by ID."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM subscription_plans WHERE id = ?", (plan_id,))
                row = cursor.fetchone()
                
                if row:
                    return PlanRepository._row_to_plan(row)
                return None
                
        except Exception as e:
            logger.error(f"Error getting plan {plan_id}: {str(e)}")
            return None
    
    @staticmethod
    def create_plan(plan_data: Dict[str, Any]) -> Optional[int]:
        """Create a new subscription plan."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                features_json = json.dumps(plan_data.get('features', []))
                
                cursor.execute('''
                    INSERT INTO subscription_plans 
                    (name, description, price, currency, interval_type, execution_limit, 
                     storage_limit, ai_analysis_limit, features, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    plan_data['name'],
                    plan_data.get('description', ''),
                    plan_data['price'],
                    plan_data.get('currency', 'INR'),
                    plan_data.get('interval', 'month'),
                    plan_data.get('executionLimit', 100),
                    plan_data.get('storageLimit', 1024),
                    plan_data.get('aiAnalysisLimit', 10),
                    features_json,
                    plan_data.get('is_active', True)
                ))
                
                plan_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Created plan with ID: {plan_id}")
                return plan_id
                
        except Exception as e:
            logger.error(f"Error creating plan: {str(e)}")
            return None
    
    @staticmethod
    def update_plan(plan_id: int, plan_data: Dict[str, Any]) -> bool:
        """Update an existing subscription plan."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build update query dynamically
                update_fields = []
                params = []
                
                if 'name' in plan_data:
                    update_fields.append('name = ?')
                    params.append(plan_data['name'])
                
                if 'description' in plan_data:
                    update_fields.append('description = ?')
                    params.append(plan_data['description'])
                
                if 'price' in plan_data:
                    update_fields.append('price = ?')
                    update_fields.append('price_per_unit = ?')
                    params.append(plan_data['price'])
                    params.append(plan_data['price'])
                
                if 'interval' in plan_data:
                    update_fields.append('interval_type = ?')
                    update_fields.append('plan_type = ?')
                    params.append(plan_data['interval'])
                    params.append(plan_data['interval'])
                
                if 'executionLimit' in plan_data:
                    update_fields.append('execution_limit = ?')
                    params.append(plan_data['executionLimit'])
                
                if 'storageLimit' in plan_data:
                    update_fields.append('storage_limit = ?')
                    params.append(plan_data['storageLimit'])
                
                if 'aiAnalysisLimit' in plan_data:
                    update_fields.append('ai_analysis_limit = ?')
                    params.append(plan_data['aiAnalysisLimit'])
                
                if 'features' in plan_data:
                    update_fields.append('features = ?')
                    params.append(json.dumps(plan_data['features']))
                
                if 'is_active' in plan_data:
                    update_fields.append('is_active = ?')
                    params.append(plan_data['is_active'])
                
                update_fields.append('updated_at = ?')
                params.append(datetime.utcnow().isoformat())
                
                params.append(plan_id)
                
                query = f"UPDATE subscription_plans SET {', '.join(update_fields)} WHERE id = ?"
                cursor.execute(query, params)
                
                conn.commit()
                
                logger.info(f"Updated plan {plan_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error updating plan {plan_id}: {str(e)}")
            return False
    
    @staticmethod
    def toggle_plan_status(plan_id: int) -> bool:
        """Toggle plan active/inactive status."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get current status
                cursor.execute("SELECT is_active FROM subscription_plans WHERE id = ?", (plan_id,))
                row = cursor.fetchone()
                
                if not row:
                    return False
                
                new_status = not bool(row['is_active'])
                
                cursor.execute('''
                    UPDATE subscription_plans 
                    SET is_active = ?, updated_at = ? 
                    WHERE id = ?
                ''', (new_status, datetime.utcnow().isoformat(), plan_id))
                
                conn.commit()
                
                logger.info(f"Toggled plan {plan_id} status to {new_status}")
                return True
                
        except Exception as e:
            logger.error(f"Error toggling plan {plan_id} status: {str(e)}")
            return False
    
    @staticmethod
    def delete_plan(plan_id: int) -> bool:
        """Delete a subscription plan (soft delete by setting inactive)."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if plan has active subscriptions
                cursor.execute('''
                    SELECT COUNT(*) FROM user_subscriptions 
                    WHERE plan_id = ? AND status = 'active'
                ''', (plan_id,))
                
                active_subscriptions = cursor.fetchone()[0]
                
                if active_subscriptions > 0:
                    # Soft delete - just deactivate
                    cursor.execute('''
                        UPDATE subscription_plans 
                        SET is_active = 0, updated_at = ? 
                        WHERE id = ?
                    ''', (datetime.utcnow().isoformat(), plan_id))
                else:
                    # Hard delete if no active subscriptions
                    cursor.execute("DELETE FROM subscription_plans WHERE id = ?", (plan_id,))
                
                conn.commit()
                
                logger.info(f"Deleted plan {plan_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting plan {plan_id}: {str(e)}")
            return False
    
    @staticmethod
    def _row_to_plan(row) -> SubscriptionPlan:
        """Convert database row to SubscriptionPlan object."""
        features = []
        if row['features']:
            try:
                features = json.loads(row['features'])
            except json.JSONDecodeError:
                features = []
        
        # Map interval_type to PlanType
        interval_type = row['interval_type'] if 'interval_type' in row.keys() else 'month'
        plan_type = PlanType.MONTHLY
        if interval_type == 'day':
            plan_type = PlanType.DAILY
        elif interval_type == 'year':
            plan_type = PlanType.YEARLY
        elif interval_type == 'custom':
            plan_type = PlanType.CUSTOM
        
        # Use price column from SQLite schema
        price = row['price'] if 'price' in row.keys() else 0
        
        return SubscriptionPlan(
            id=row['id'],
            name=row['name'],
            description=row['description'] or '',
            plan_type=plan_type,
            price_per_unit=Decimal(str(price)) if price else Decimal('0'),
            currency=row['currency'] or 'INR',
            features={
                'features': features,
                'execution_limit': row['execution_limit'] if 'execution_limit' in row.keys() else 100,
                'storage_limit': row['storage_limit'] if 'storage_limit' in row.keys() else 1024,
                'ai_analysis_limit': row['ai_analysis_limit'] if 'ai_analysis_limit' in row.keys() else 10
            },
            is_active=bool(row['is_active']),
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None,
            updated_at=datetime.fromisoformat(row['updated_at']) if row['updated_at'] else None
        )
    
    @staticmethod
    def get_plan_stats() -> Dict[str, Any]:
        """Get plan statistics for admin dashboard."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Total plans
                cursor.execute("SELECT COUNT(*) FROM subscription_plans")
                total_plans = cursor.fetchone()[0]
                
                # Active plans
                cursor.execute("SELECT COUNT(*) FROM subscription_plans WHERE is_active = 1")
                active_plans = cursor.fetchone()[0]
                
                # Most popular plans
                cursor.execute('''
                    SELECT p.name, COUNT(s.id) as subscriber_count
                    FROM subscription_plans p
                    LEFT JOIN user_subscriptions s ON p.id = s.plan_id AND s.status = 'active'
                    GROUP BY p.id, p.name
                    ORDER BY subscriber_count DESC
                    LIMIT 5
                ''')
                popular_plans = cursor.fetchall()
                
                return {
                    'total_plans': total_plans,
                    'active_plans': active_plans,
                    'popular_plans': [dict(row) for row in popular_plans]
                }
                
        except Exception as e:
            logger.error(f"Error getting plan stats: {str(e)}")
            return {
                'total_plans': 0,
                'active_plans': 0,
                'popular_plans': []
            }
        

# In app/database/plan_repository.py

@staticmethod
def ensure_default_free_plan():
    """Ensure the default free plan exists in the database."""
    plans = PlanRepository.get_all_plans()
    for plan in plans:
        if plan.name.lower() == 'free trial':
            return  # Already exists

    # Create default free plan
    default_plan = {
        'name': 'Free Trial',
        'description': '5 free AI analysis and code generation requests per day. Resets at midnight IST.',
        'price': 0,
        'currency': 'INR',
        'interval': 'day',
        'executionLimit': 5,
        'aiAnalysisLimit': 5,
        'features': ['ai_analysis', 'code_generation'],
        'is_active': True
    }
    PlanRepository.create_plan(default_plan)