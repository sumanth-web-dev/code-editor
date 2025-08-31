"""
Admin service for dashboard statistics and management operations.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from app.database.connection import get_db_connection
import logging

logger = logging.getLogger(__name__)

class AdminService:
    """Service for admin dashboard operations."""
    
    def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get comprehensive dashboard statistics."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get total users
                cursor.execute('SELECT COUNT(*) FROM users')
                total_users = cursor.fetchone()[0]
                
                # Get active subscriptions
                cursor.execute('''
                    SELECT COUNT(*) FROM user_subscriptions 
                    WHERE status = 'active' AND end_date > date('now')
                ''')
                active_subscriptions = cursor.fetchone()[0]
                
                # Get total revenue
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM payments 
                    WHERE status = 'completed'
                ''')
                total_revenue = cursor.fetchone()[0]
                
                # Get monthly revenue (current month)
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM payments 
                    WHERE status = 'completed' 
                    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
                ''')
                monthly_revenue = cursor.fetchone()[0]
                
                # Get new users today
                cursor.execute('''
                    SELECT COUNT(*) FROM users 
                    WHERE date(created_at) = date('now')
                ''')
                new_users_today = cursor.fetchone()[0]
                
                # Get new subscriptions today
                cursor.execute('''
                    SELECT COUNT(*) FROM user_subscriptions 
                    WHERE date(created_at) = date('now')
                ''')
                new_subscriptions_today = cursor.fetchone()[0]
                
                # Get revenue today
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM payments 
                    WHERE status = 'completed' 
                    AND date(created_at) = date('now')
                ''')
                revenue_today = cursor.fetchone()[0]
                
                # Get top plans
                cursor.execute('''
                    SELECT sp.name, COUNT(us.id) as subscribers, 
                           COALESCE(SUM(p.amount), 0) as revenue
                    FROM subscription_plans sp
                    LEFT JOIN user_subscriptions us ON sp.id = us.plan_id
                    LEFT JOIN payments p ON us.id = p.subscription_id AND p.status = 'completed'
                    WHERE sp.is_active = 1
                    GROUP BY sp.id, sp.name
                    ORDER BY subscribers DESC
                    LIMIT 5
                ''')
                top_plans_data = cursor.fetchall()
                
                top_plans = []
                for plan in top_plans_data:
                    top_plans.append({
                        'plan_name': plan[0],
                        'subscribers': plan[1],
                        'revenue': float(plan[2])
                    })
                
                # Get recent activity
                recent_activity = self._get_recent_activity(cursor)
                
                return {
                    'total_users': total_users,
                    'active_subscriptions': active_subscriptions,
                    'total_revenue': float(total_revenue),
                    'monthly_revenue': float(monthly_revenue),
                    'new_users_today': new_users_today,
                    'new_subscriptions_today': new_subscriptions_today,
                    'revenue_today': float(revenue_today),
                    'top_plans': top_plans,
                    'recent_activity': recent_activity
                }
                
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {str(e)}")
            # Return default stats if database query fails
            return {
                'total_users': 0,
                'active_subscriptions': 0,
                'total_revenue': 0.0,
                'monthly_revenue': 0.0,
                'new_users_today': 0,
                'new_subscriptions_today': 0,
                'revenue_today': 0.0,
                'top_plans': [],
                'recent_activity': []
            }
    
    def _get_recent_activity(self, cursor) -> List[Dict[str, Any]]:
        """Get recent system activity."""
        try:
            # Get recent user registrations
            cursor.execute('''
                SELECT 'new_user' as type, 
                       'New user registered: ' || email as message,
                       created_at as timestamp
                FROM users 
                WHERE created_at >= datetime('now', '-24 hours')
                ORDER BY created_at DESC
                LIMIT 5
            ''')
            user_activities = cursor.fetchall()
            
            # Get recent payments
            cursor.execute('''
                SELECT 'payment' as type,
                       'Payment completed: $' || amount as message,
                       created_at as timestamp
                FROM payments
                WHERE status = 'completed' 
                AND created_at >= datetime('now', '-24 hours')
                ORDER BY created_at DESC
                LIMIT 5
            ''')
            payment_activities = cursor.fetchall()
            
            # Get recent subscriptions
            cursor.execute('''
                SELECT 'subscription' as type,
                       'New subscription: ' || sp.name as message,
                       us.created_at as timestamp
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.created_at >= datetime('now', '-24 hours')
                ORDER BY us.created_at DESC
                LIMIT 5
            ''')
            subscription_activities = cursor.fetchall()
            
            # Combine and sort all activities
            all_activities = []
            
            for activity in user_activities:
                all_activities.append({
                    'type': activity[0],
                    'message': activity[1],
                    'timestamp': activity[2]
                })
            
            for activity in payment_activities:
                all_activities.append({
                    'type': activity[0],
                    'message': activity[1],
                    'timestamp': activity[2]
                })
            
            for activity in subscription_activities:
                all_activities.append({
                    'type': activity[0],
                    'message': activity[1],
                    'timestamp': activity[2]
                })
            
            # Sort by timestamp (most recent first)
            all_activities.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return all_activities[:10]  # Return top 10 most recent
            
        except Exception as e:
            logger.error(f"Error getting recent activity: {str(e)}")
            return []
    
    def get_users_list(self, page: int = 1, per_page: int = 20, 
                      search: str = '', role: str = '', status: str = '') -> Dict[str, Any]:
        """Get paginated list of users with filters."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build WHERE clause
                where_conditions = []
                params = []
                
                if search:
                    where_conditions.append('''
                        (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
                    ''')
                    search_param = f'%{search}%'
                    params.extend([search_param, search_param, search_param])
                
                if role:
                    where_conditions.append('role = ?')
                    params.append(role)
                
                if status:
                    is_active = status.lower() == 'active'
                    where_conditions.append('is_active = ?')
                    params.append(is_active)
                
                where_clause = ''
                if where_conditions:
                    where_clause = 'WHERE ' + ' AND '.join(where_conditions)
                
                # Get total count
                count_query = f'SELECT COUNT(*) FROM users {where_clause}'
                cursor.execute(count_query, params)
                total_users = cursor.fetchone()[0]
                
                # Get paginated users
                offset = (page - 1) * per_page
                users_query = f'''
                    SELECT id, email, first_name, last_name, role, is_active, 
                           email_verified, created_at, last_login
                    FROM users 
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                '''
                cursor.execute(users_query, params + [per_page, offset])
                users_data = cursor.fetchall()
                
                users = []
                for user in users_data:
                    # Get user's active subscriptions
                    cursor.execute('''
                        SELECT us.id, sp.name, us.status, us.start_date, us.end_date
                        FROM user_subscriptions us
                        JOIN subscription_plans sp ON us.plan_id = sp.id
                        WHERE us.user_id = ?
                        ORDER BY us.created_at DESC
                        LIMIT 3
                    ''', (user[0],))
                    user_plans = cursor.fetchall()
                    
                    plans_list = []
                    for plan in user_plans:
                        plans_list.append({
                            'id': plan[0],
                            'name': plan[1],
                            'status': plan[2],
                            'start_date': plan[3],
                            'end_date': plan[4]
                        })
                    
                    users.append({
                        'id': user[0],
                        'email': user[1],
                        'first_name': user[2],
                        'last_name': user[3],
                        'name': f"{user[2]} {user[3]}",
                        'role': user[4],
                        'is_active': bool(user[5]),
                        'email_verified': bool(user[6]),
                        'created_at': user[7],
                        'last_login': user[8],
                        'plans': plans_list
                    })
                
                total_pages = (total_users + per_page - 1) // per_page
                
                return {
                    'users': users,
                    'pagination': {
                        'page': page,
                        'per_page': per_page,
                        'total': total_users,
                        'pages': total_pages
                    },
                    'filters': {
                        'search': search,
                        'role': role,
                        'status': status
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting users list: {str(e)}")
            return {
                'users': [],
                'pagination': {'page': 1, 'per_page': per_page, 'total': 0, 'pages': 0},
                'filters': {'search': search, 'role': role, 'status': status}
            }
    
    def get_subscriptions_list(self, page: int = 1, per_page: int = 20,
                              status: str = '', plan_id: str = '', user_email: str = '') -> Dict[str, Any]:
        """Get paginated list of subscriptions with filters."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build WHERE clause
                where_conditions = []
                params = []
                
                if status:
                    where_conditions.append('us.status = ?')
                    params.append(status)
                
                if plan_id:
                    where_conditions.append('us.plan_id = ?')
                    params.append(int(plan_id))
                
                if user_email:
                    where_conditions.append('u.email LIKE ?')
                    params.append(f'%{user_email}%')
                
                where_clause = ''
                if where_conditions:
                    where_clause = 'WHERE ' + ' AND '.join(where_conditions)
                
                # Get total count
                count_query = f'''
                    SELECT COUNT(*) FROM user_subscriptions us
                    JOIN users u ON us.user_id = u.id
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    {where_clause}
                '''
                cursor.execute(count_query, params)
                total_subscriptions = cursor.fetchone()[0]
                
                # Get paginated subscriptions
                offset = (page - 1) * per_page
                subscriptions_query = f'''
                    SELECT us.id, us.user_id, u.email, u.first_name, u.last_name,
                           us.plan_id, sp.name as plan_name, us.status,
                           us.start_date, us.end_date, us.total_amount, us.currency,
                           us.auto_renew, us.created_at,
                           CASE 
                               WHEN us.end_date > date('now') THEN 
                                   julianday(us.end_date) - julianday('now')
                               ELSE 0
                           END as days_remaining
                    FROM user_subscriptions us
                    JOIN users u ON us.user_id = u.id
                    JOIN subscription_plans sp ON us.plan_id = sp.id
                    {where_clause}
                    ORDER BY us.created_at DESC
                    LIMIT ? OFFSET ?
                '''
                cursor.execute(subscriptions_query, params + [per_page, offset])
                subscriptions_data = cursor.fetchall()
                
                subscriptions = []
                for sub in subscriptions_data:
                    subscriptions.append({
                        'id': sub[0],
                        'user_id': sub[1],
                        'user_email': sub[2],
                        'user_name': f"{sub[3]} {sub[4]}",
                        'plan_id': sub[5],
                        'plan': {'name': sub[6]},
                        'status': sub[7],
                        'start_date': sub[8],
                        'end_date': sub[9],
                        'total_amount': float(sub[10]),
                        'currency': sub[11],
                        'auto_renew': bool(sub[12]),
                        'created_at': sub[13],
                        'days_remaining': int(sub[14])
                    })
                
                total_pages = (total_subscriptions + per_page - 1) // per_page
                
                return {
                    'subscriptions': subscriptions,
                    'pagination': {
                        'page': page,
                        'per_page': per_page,
                        'total': total_subscriptions,
                        'pages': total_pages
                    },
                    'filters': {
                        'status': status,
                        'plan_id': plan_id,
                        'user_email': user_email
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting subscriptions list: {str(e)}")
            return {
                'subscriptions': [],
                'pagination': {'page': 1, 'per_page': per_page, 'total': 0, 'pages': 0},
                'filters': {'status': status, 'plan_id': plan_id, 'user_email': user_email}
            }
    
    def get_payments_list(self, page: int = 1, per_page: int = 20,
                         status: str = '', gateway: str = '', user_email: str = '') -> Dict[str, Any]:
        """Get paginated list of payments with filters."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build WHERE clause
                where_conditions = []
                params = []
                
                if status:
                    where_conditions.append('p.status = ?')
                    params.append(status)
                
                if gateway:
                    where_conditions.append('p.payment_gateway = ?')
                    params.append(gateway)
                
                if user_email:
                    where_conditions.append('u.email LIKE ?')
                    params.append(f'%{user_email}%')
                
                where_clause = ''
                if where_conditions:
                    where_clause = 'WHERE ' + ' AND '.join(where_conditions)
                
                # Get total count
                count_query = f'''
                    SELECT COUNT(*) FROM payments p
                    JOIN users u ON p.user_id = u.id
                    {where_clause}
                '''
                cursor.execute(count_query, params)
                total_payments = cursor.fetchone()[0]
                
                # Get paginated payments
                offset = (page - 1) * per_page
                payments_query = f'''
                    SELECT p.id, p.user_id, u.email, u.first_name, u.last_name,
                           p.subscription_id, p.amount, p.currency, p.status,
                           p.payment_gateway, p.gateway_transaction_id,
                           p.created_at, p.completed_at, p.payment_method
                    FROM payments p
                    JOIN users u ON p.user_id = u.id
                    {where_clause}
                    ORDER BY p.created_at DESC
                    LIMIT ? OFFSET ?
                '''
                cursor.execute(payments_query, params + [per_page, offset])
                payments_data = cursor.fetchall()
                
                payments = []
                for payment in payments_data:
                    payments.append({
                        'id': payment[0],
                        'user_id': payment[1],
                        'user_email': payment[2],
                        'user_name': f"{payment[3]} {payment[4]}",
                        'subscription_id': payment[5],
                        'amount': float(payment[6]),
                        'currency': payment[7],
                        'status': payment[8],
                        'payment_gateway': payment[9],
                        'gateway_transaction_id': payment[10],
                        'created_at': payment[11],
                        'completed_at': payment[12],
                        'payment_method': payment[13]
                    })
                
                total_pages = (total_payments + per_page - 1) // per_page
                
                return {
                    'payments': payments,
                    'pagination': {
                        'page': page,
                        'per_page': per_page,
                        'total': total_payments,
                        'pages': total_pages
                    },
                    'filters': {
                        'status': status,
                        'gateway': gateway,
                        'user_email': user_email
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting payments list: {str(e)}")
            return {
                'payments': [],
                'pagination': {'page': 1, 'per_page': per_page, 'total': 0, 'pages': 0},
                'filters': {'status': status, 'gateway': gateway, 'user_email': user_email}
            }
    
    def extend_subscription(self, subscription_id: int, days: int, reason: str = '') -> Tuple[bool, str]:
        """Extend a subscription by specified number of days."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get current subscription
                cursor.execute('''
                    SELECT id, end_date, status FROM user_subscriptions 
                    WHERE id = ?
                ''', (subscription_id,))
                subscription = cursor.fetchone()
                
                if not subscription:
                    return False, "Subscription not found"
                
                # Calculate new end date
                current_end_date = datetime.fromisoformat(subscription[1])
                new_end_date = current_end_date + timedelta(days=days)
                
                # Update subscription
                cursor.execute('''
                    UPDATE user_subscriptions 
                    SET end_date = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (new_end_date.date().isoformat(), subscription_id))
                
                # Log the extension in audit_logs if table exists
                try:
                    cursor.execute('''
                        INSERT INTO audit_logs (action, target_type, target_id, new_values, created_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ''', (
                        'extend_subscription',
                        'subscription',
                        subscription_id,
                        f'{{"days": {days}, "reason": "{reason}", "new_end_date": "{new_end_date.date().isoformat()}"}}'
                    ))
                except:
                    pass  # Audit table might not exist
                
                conn.commit()
                
                logger.info(f"Subscription {subscription_id} extended by {days} days. Reason: {reason}")
                return True, f"Subscription extended by {days} days successfully"
                
        except Exception as e:
            logger.error(f"Error extending subscription: {str(e)}")
            return False, f"Failed to extend subscription: {str(e)}"
    
    def cancel_subscription(self, subscription_id: int, reason: str = '') -> Tuple[bool, str]:
        """Cancel a subscription."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get current subscription
                cursor.execute('''
                    SELECT id, status FROM user_subscriptions 
                    WHERE id = ?
                ''', (subscription_id,))
                subscription = cursor.fetchone()
                
                if not subscription:
                    return False, "Subscription not found"
                
                if subscription[1] == 'cancelled':
                    return False, "Subscription is already cancelled"
                
                # Update subscription status
                cursor.execute('''
                    UPDATE user_subscriptions 
                    SET status = 'cancelled', 
                        cancelled_at = CURRENT_TIMESTAMP,
                        cancellation_reason = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (reason, subscription_id))
                
                # Log the cancellation
                try:
                    cursor.execute('''
                        INSERT INTO audit_logs (action, target_type, target_id, new_values, created_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ''', (
                        'cancel_subscription',
                        'subscription',
                        subscription_id,
                        f'{{"reason": "{reason}"}}'
                    ))
                except:
                    pass
                
                conn.commit()
                
                logger.info(f"Subscription {subscription_id} cancelled. Reason: {reason}")
                return True, "Subscription cancelled successfully"
                
        except Exception as e:
            logger.error(f"Error cancelling subscription: {str(e)}")
            return False, f"Failed to cancel subscription: {str(e)}"
    
    def process_refund(self, payment_id: int, amount: Optional[float] = None, reason: str = '') -> Tuple[bool, str]:
        """Process a refund for a payment."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get payment details
                cursor.execute('''
                    SELECT id, amount, status, payment_gateway, gateway_transaction_id
                    FROM payments WHERE id = ?
                ''', (payment_id,))
                payment = cursor.fetchone()
                
                if not payment:
                    return False, "Payment not found"
                
                if payment[2] != 'completed':
                    return False, "Can only refund completed payments"
                
                original_amount = float(payment[1])
                refund_amount = amount if amount is not None else original_amount
                
                if refund_amount > original_amount:
                    return False, "Refund amount cannot exceed original payment amount"
                
                # Update payment status
                cursor.execute('''
                    UPDATE payments 
                    SET status = 'refunded',
                        failed_reason = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (f"Refunded: {reason}", payment_id))
                
                # Create refund record (you might want a separate refunds table)
                # For now, we'll log it in audit_logs
                try:
                    cursor.execute('''
                        INSERT INTO audit_logs (action, target_type, target_id, new_values, created_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ''', (
                        'process_refund',
                        'payment',
                        payment_id,
                        f'{{"refund_amount": {refund_amount}, "original_amount": {original_amount}, "reason": "{reason}"}}'
                    ))
                except:
                    pass
                
                conn.commit()
                
                # In a real implementation, you would also call the payment gateway's refund API
                # For now, we'll just update the database
                
                logger.info(f"Refund processed for payment {payment_id}. Amount: ${refund_amount}. Reason: {reason}")
                return True, f"Refund of ${refund_amount} processed successfully"
                
        except Exception as e:
            logger.error(f"Error processing refund: {str(e)}")
            return False, f"Failed to process refund: {str(e)}"
    
    def get_revenue_analytics(self, period: str = 'monthly') -> Dict[str, Any]:
        """Get comprehensive revenue analytics data with charts."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get total revenue
                cursor.execute('''
                    SELECT COALESCE(SUM(amount), 0) FROM payments 
                    WHERE status = 'completed'
                ''')
                total_revenue = float(cursor.fetchone()[0])
                
                # Get revenue growth (compare with previous period)
                if period == 'monthly':
                    cursor.execute('''
                        SELECT COALESCE(SUM(amount), 0) FROM payments 
                        WHERE status = 'completed' 
                        AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')
                    ''')
                    previous_revenue = float(cursor.fetchone()[0])
                    
                    cursor.execute('''
                        SELECT COALESCE(SUM(amount), 0) FROM payments 
                        WHERE status = 'completed' 
                        AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
                    ''')
                    current_revenue = float(cursor.fetchone()[0])
                else:
                    previous_revenue = 0
                    current_revenue = total_revenue
                
                # Calculate growth percentage
                revenue_growth = 0
                if previous_revenue > 0:
                    revenue_growth = ((current_revenue - previous_revenue) / previous_revenue) * 100
                
                # Get monthly revenue trend for chart (last 12 months)
                cursor.execute('''
                    SELECT 
                        strftime('%Y-%m', created_at) as month,
                        COALESCE(SUM(amount), 0) as revenue,
                        COUNT(*) as transactions
                    FROM payments 
                    WHERE status = 'completed' 
                    AND created_at >= date('now', '-12 months')
                    GROUP BY strftime('%Y-%m', created_at)
                    ORDER BY month ASC
                ''')
                monthly_data = cursor.fetchall()
                
                # Get daily revenue for current month
                cursor.execute('''
                    SELECT 
                        strftime('%Y-%m-%d', created_at) as day,
                        COALESCE(SUM(amount), 0) as revenue,
                        COUNT(*) as transactions
                    FROM payments 
                    WHERE status = 'completed' 
                    AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
                    GROUP BY strftime('%Y-%m-%d', created_at)
                    ORDER BY day ASC
                ''')
                daily_data = cursor.fetchall()
                
                # Get top plans by revenue
                cursor.execute('''
                    SELECT sp.name, COALESCE(SUM(p.amount), 0) as revenue,
                           COUNT(p.id) as transactions,
                           COUNT(DISTINCT us.user_id) as unique_subscribers
                    FROM subscription_plans sp
                    LEFT JOIN user_subscriptions us ON sp.id = us.plan_id
                    LEFT JOIN payments p ON us.id = p.subscription_id AND p.status = 'completed'
                    WHERE sp.is_active = 1
                    GROUP BY sp.id, sp.name
                    ORDER BY revenue DESC
                    LIMIT 10
                ''')
                top_plans_data = cursor.fetchall()
                
                # Get payment method distribution
                cursor.execute('''
                    SELECT 
                        payment_gateway,
                        COUNT(*) as count,
                        COALESCE(SUM(amount), 0) as revenue
                    FROM payments 
                    WHERE status = 'completed'
                    GROUP BY payment_gateway
                    ORDER BY revenue DESC
                ''')
                payment_methods = cursor.fetchall()
                
                # Get subscription status distribution
                cursor.execute('''
                    SELECT 
                        status,
                        COUNT(*) as count
                    FROM user_subscriptions
                    GROUP BY status
                ''')
                subscription_status = cursor.fetchall()
                
                # Get user growth data
                cursor.execute('''
                    SELECT 
                        strftime('%Y-%m', created_at) as month,
                        COUNT(*) as new_users
                    FROM users 
                    WHERE created_at >= date('now', '-12 months')
                    GROUP BY strftime('%Y-%m', created_at)
                    ORDER BY month ASC
                ''')
                user_growth = cursor.fetchall()
                
                # Calculate conversion rates
                cursor.execute('SELECT COUNT(*) FROM users')
                total_users = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(DISTINCT user_id) FROM user_subscriptions WHERE status = "active"')
                paying_users = cursor.fetchone()[0]
                
                conversion_rate = (paying_users / total_users * 100) if total_users > 0 else 0
                
                # Format data for charts
                chart_data = {
                    'monthly_revenue': {
                        'labels': [row[0] for row in monthly_data],
                        'data': [float(row[1]) for row in monthly_data],
                        'transactions': [row[2] for row in monthly_data]
                    },
                    'daily_revenue': {
                        'labels': [row[0] for row in daily_data],
                        'data': [float(row[1]) for row in daily_data],
                        'transactions': [row[2] for row in daily_data]
                    },
                    'top_plans': [
                        {
                            'name': row[0],
                            'revenue': float(row[1]),
                            'transactions': row[2],
                            'subscribers': row[3],
                            'percentage': (float(row[1]) / total_revenue * 100) if total_revenue > 0 else 0
                        }
                        for row in top_plans_data
                    ],
                    'payment_methods': [
                        {
                            'method': row[0],
                            'count': row[1],
                            'revenue': float(row[2]),
                            'percentage': (row[1] / sum([r[1] for r in payment_methods]) * 100) if payment_methods else 0
                        }
                        for row in payment_methods
                    ],
                    'subscription_status': [
                        {
                            'status': row[0],
                            'count': row[1],
                            'percentage': (row[1] / sum([r[1] for r in subscription_status]) * 100) if subscription_status else 0
                        }
                        for row in subscription_status
                    ],
                    'user_growth': {
                        'labels': [row[0] for row in user_growth],
                        'data': [row[1] for row in user_growth]
                    }
                }
                
                return {
                    'total_revenue': total_revenue,
                    'current_revenue': current_revenue,
                    'previous_revenue': previous_revenue,
                    'revenue_growth': revenue_growth,
                    'total_users': total_users,
                    'paying_users': paying_users,
                    'conversion_rate': conversion_rate,
                    'chart_data': chart_data,
                    'period': period
                }
                
        except Exception as e:
            logger.error(f"Error getting revenue analytics: {str(e)}")
            return {
                'total_revenue': 0.0,
                'current_revenue': 0.0,
                'previous_revenue': 0.0,
                'revenue_growth': 0.0,
                'total_users': 0,
                'paying_users': 0,
                'conversion_rate': 0.0,
                'chart_data': {
                    'monthly_revenue': {'labels': [], 'data': [], 'transactions': []},
                    'daily_revenue': {'labels': [], 'data': [], 'transactions': []},
                    'top_plans': [],
                    'payment_methods': [],
                    'subscription_status': [],
                    'user_growth': {'labels': [], 'data': []}
                },
                'period': period
            }

    def update_user(self, user_id: int, user_data: Dict[str, Any]) -> Tuple[bool, str]:
        """Update user information."""
        try:
            from app.database.user_repository import UserRepository
            
            # Update user in database
            success = UserRepository.update_user(user_id, user_data)
            
            if success:
                logger.info(f"User {user_id} updated successfully")
                return True, "User updated successfully"
            else:
                return False, "Failed to update user in database"
                
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {str(e)}")
            return False, f"Failed to update user: {str(e)}"
    
    def delete_user(self, user_id: int) -> Tuple[bool, str]:
        """Delete a user (soft delete by deactivating)."""
        try:
            from app.database.user_repository import UserRepository
            
            # Check if user exists
            user = UserRepository.get_user_by_id(user_id)
            if not user:
                return False, "User not found"
            
            # Delete user (soft delete)
            success = UserRepository.delete_user(user_id)
            
            if success:
                logger.info(f"User {user_id} deleted successfully")
                return True, "User deleted successfully"
            else:
                return False, "Failed to delete user from database"
                
        except Exception as e:
            logger.error(f"Error deleting user {user_id}: {str(e)}")
            return False, f"Failed to delete user: {str(e)}"

# Global admin service instance
admin_service = AdminService()