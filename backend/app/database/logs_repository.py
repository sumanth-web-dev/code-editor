"""
Repository for system logs and resource monitoring.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from app.database.connection import get_db_connection
import logging
import psutil
import os

logger = logging.getLogger(__name__)

class LogsRepository:
    """Repository for system logs and monitoring."""

    @staticmethod
    def log_system_event(level: str, category: str, message: str, 
                        details: Optional[Dict] = None, user_id: Optional[int] = None, 
                        ip_address: Optional[str] = None):
        """Log a system event."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO system_logs (level, category, message, details, user_id, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (level, category, message, str(details) if details else None, user_id, ip_address))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to log system event: {str(e)}")

    @staticmethod
    def get_system_logs(page: int = 1, per_page: int = 50, level: str = '', 
                       category: str = '', hours: int = 24) -> Dict[str, Any]:
        """Get system logs with pagination and filtering."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build WHERE clause
                where_conditions = []
                params = []
                
                # Filter by time
                since_time = datetime.now() - timedelta(hours=hours)
                where_conditions.append('created_at >= ?')
                params.append(since_time.isoformat())
                
                if level:
                    where_conditions.append('level = ?')
                    params.append(level)
                
                if category:
                    where_conditions.append('category = ?')
                    params.append(category)
                
                where_clause = 'WHERE ' + ' AND '.join(where_conditions)
                
                # Get total count
                count_query = f'SELECT COUNT(*) FROM system_logs {where_clause}'
                cursor.execute(count_query, params)
                total_logs = cursor.fetchone()[0]
                
                # Get paginated logs
                offset = (page - 1) * per_page
                logs_query = f'''
                    SELECT sl.*, u.email as user_email
                    FROM system_logs sl
                    LEFT JOIN users u ON sl.user_id = u.id
                    {where_clause}
                    ORDER BY sl.created_at DESC
                    LIMIT ? OFFSET ?
                '''
                cursor.execute(logs_query, params + [per_page, offset])
                logs_data = cursor.fetchall()
                
                logs = []
                for log in logs_data:
                    logs.append({
                        'id': log[0],
                        'level': log[1],
                        'category': log[2],
                        'message': log[3],
                        'details': log[4],
                        'user_id': log[5],
                        'user_email': log[9] if log[9] else None,
                        'ip_address': log[6],
                        'created_at': log[7]
                    })
                
                total_pages = (total_logs + per_page - 1) // per_page
                
                return {
                    'logs': logs,
                    'pagination': {
                        'page': page,
                        'per_page': per_page,
                        'total': total_logs,
                        'pages': total_pages
                    },
                    'filters': {
                        'level': level,
                        'category': category,
                        'hours': hours
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting system logs: {str(e)}")
            return {
                'logs': [],
                'pagination': {'page': 1, 'per_page': per_page, 'total': 0, 'pages': 0},
                'filters': {'level': level, 'category': category, 'hours': hours}
            }

    @staticmethod
    def record_resource_usage():
        """Record current system resource usage."""
        try:
            # Get system metrics
            cpu_usage = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Get active users count (simplified)
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Active users in last hour
                cursor.execute('''
                    SELECT COUNT(DISTINCT user_id) FROM user_sessions 
                    WHERE last_accessed >= datetime('now', '-1 hour') AND is_active = 1
                ''')
                active_users = cursor.fetchone()[0] or 0
                
                # Current executions (simplified - would need execution tracking)
                concurrent_executions = 0
                
                # AI requests per minute (simplified)
                cursor.execute('''
                    SELECT COUNT(*) FROM usage_logs 
                    WHERE action_type LIKE '%ai%' 
                    AND created_at >= datetime('now', '-1 minute')
                ''')
                ai_requests = cursor.fetchone()[0] or 0
                
                # Insert resource usage record
                cursor.execute('''
                    INSERT INTO resource_usage 
                    (cpu_usage, memory_usage, disk_usage, active_users, concurrent_executions, ai_requests_per_minute)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    cpu_usage,
                    memory.percent,
                    (disk.used / disk.total) * 100,
                    active_users,
                    concurrent_executions,
                    ai_requests
                ))
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to record resource usage: {str(e)}")

    @staticmethod
    def get_resource_usage(hours: int = 24) -> Dict[str, Any]:
        """Get resource usage data for monitoring."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                since_time = datetime.now() - timedelta(hours=hours)
                
                # Get resource usage data
                cursor.execute('''
                    SELECT timestamp, cpu_usage, memory_usage, disk_usage, 
                           active_users, concurrent_executions, ai_requests_per_minute
                    FROM resource_usage 
                    WHERE timestamp >= ?
                    ORDER BY timestamp DESC
                    LIMIT 100
                ''', (since_time.isoformat(),))
                
                usage_data = cursor.fetchall()
                
                # Get current system info
                current_cpu = psutil.cpu_percent()
                current_memory = psutil.virtual_memory().percent
                current_disk = (psutil.disk_usage('/').used / psutil.disk_usage('/').total) * 100
                
                # Get active users
                cursor.execute('''
                    SELECT COUNT(DISTINCT user_id) FROM user_sessions 
                    WHERE last_accessed >= datetime('now', '-1 hour') AND is_active = 1
                ''')
                current_active_users = cursor.fetchone()[0] or 0
                
                return {
                    'current': {
                        'cpu_usage': current_cpu,
                        'memory_usage': current_memory,
                        'disk_usage': current_disk,
                        'active_users': current_active_users,
                        'timestamp': datetime.now().isoformat()
                    },
                    'history': [
                        {
                            'timestamp': row[0],
                            'cpu_usage': float(row[1]) if row[1] else 0,
                            'memory_usage': float(row[2]) if row[2] else 0,
                            'disk_usage': float(row[3]) if row[3] else 0,
                            'active_users': row[4] or 0,
                            'concurrent_executions': row[5] or 0,
                            'ai_requests_per_minute': row[6] or 0
                        }
                        for row in usage_data
                    ]
                }
                
        except Exception as e:
            logger.error(f"Error getting resource usage: {str(e)}")
            return {
                'current': {
                    'cpu_usage': 0,
                    'memory_usage': 0,
                    'disk_usage': 0,
                    'active_users': 0,
                    'timestamp': datetime.now().isoformat()
                },
                'history': []
            }

    @staticmethod
    def get_log_summary() -> Dict[str, Any]:
        """Get summary of logs for dashboard."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get log counts by level (last 24 hours)
                cursor.execute('''
                    SELECT level, COUNT(*) as count
                    FROM system_logs 
                    WHERE created_at >= datetime('now', '-24 hours')
                    GROUP BY level
                ''')
                level_counts = {row[0]: row[1] for row in cursor.fetchall()}
                
                # Get log counts by category (last 24 hours)
                cursor.execute('''
                    SELECT category, COUNT(*) as count
                    FROM system_logs 
                    WHERE created_at >= datetime('now', '-24 hours')
                    GROUP BY category
                    ORDER BY count DESC
                    LIMIT 10
                ''')
                category_counts = [{'category': row[0], 'count': row[1]} for row in cursor.fetchall()]
                
                # Get recent errors
                cursor.execute('''
                    SELECT message, created_at
                    FROM system_logs 
                    WHERE level IN ('error', 'critical')
                    AND created_at >= datetime('now', '-24 hours')
                    ORDER BY created_at DESC
                    LIMIT 5
                ''')
                recent_errors = [{'message': row[0], 'timestamp': row[1]} for row in cursor.fetchall()]
                
                return {
                    'level_counts': level_counts,
                    'category_counts': category_counts,
                    'recent_errors': recent_errors,
                    'total_logs_24h': sum(level_counts.values())
                }
                
        except Exception as e:
            logger.error(f"Error getting log summary: {str(e)}")
            return {
                'level_counts': {},
                'category_counts': [],
                'recent_errors': [],
                'total_logs_24h': 0
            }

    @staticmethod
    def get_system_logs_filtered(level: str = '', category: str = '', 
                                date_from: str = '', date_to: str = '', 
                                limit: int = 100) -> List[Dict[str, Any]]:
        """Get system logs with filtering."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build WHERE clause
                where_conditions = []
                params = []
                
                if level:
                    where_conditions.append('level = ?')
                    params.append(level)
                
                if category:
                    where_conditions.append('category = ?')
                    params.append(category)
                
                if date_from:
                    where_conditions.append('created_at >= ?')
                    params.append(f"{date_from} 00:00:00")
                
                if date_to:
                    where_conditions.append('created_at <= ?')
                    params.append(f"{date_to} 23:59:59")
                
                where_clause = 'WHERE ' + ' AND '.join(where_conditions) if where_conditions else ''
                
                # Get logs
                query = f'''
                    SELECT sl.*, u.email as user_email
                    FROM system_logs sl
                    LEFT JOIN users u ON sl.user_id = u.id
                    {where_clause}
                    ORDER BY sl.created_at DESC
                    LIMIT ?
                '''
                cursor.execute(query, params + [limit])
                logs_data = cursor.fetchall()
                
                logs = []
                for log in logs_data:
                    logs.append({
                        'id': log[0],
                        'level': log[1],
                        'category': log[2],
                        'message': log[3],
                        'details': log[4],
                        'user_id': log[5],
                        'user_email': log[9] if len(log) > 9 and log[9] else None,
                        'ip_address': log[6],
                        'created_at': log[7]
                    })
                
                return logs
                
        except Exception as e:
            logger.error(f"Error getting filtered system logs: {str(e)}")
            return []

    @staticmethod
    def get_audit_logs_filtered(date_from: str = '', date_to: str = '', 
                               limit: int = 100) -> List[Dict[str, Any]]:
        """Get audit logs with filtering."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build WHERE clause
                where_conditions = []
                params = []
                
                if date_from:
                    where_conditions.append('created_at >= ?')
                    params.append(f"{date_from} 00:00:00")
                
                if date_to:
                    where_conditions.append('created_at <= ?')
                    params.append(f"{date_to} 23:59:59")
                
                where_clause = 'WHERE ' + ' AND '.join(where_conditions) if where_conditions else ''
                
                # Get audit logs
                query = f'''
                    SELECT al.*, u.email as admin_email
                    FROM audit_logs al
                    LEFT JOIN users u ON al.admin_user_id = u.id
                    {where_clause}
                    ORDER BY al.created_at DESC
                    LIMIT ?
                '''
                cursor.execute(query, params + [limit])
                logs_data = cursor.fetchall()
                
                logs = []
                for log in logs_data:
                    logs.append({
                        'id': log[0],
                        'admin_user_id': log[1],
                        'admin_email': log[9] if len(log) > 9 and log[9] else None,
                        'action': log[2],
                        'target_type': log[3],
                        'target_id': log[4],
                        'old_values': log[5],
                        'new_values': log[6],
                        'ip_address': log[7],
                        'created_at': log[8]
                    })
                
                return logs
                
        except Exception as e:
            logger.error(f"Error getting filtered audit logs: {str(e)}")
            return []

    @staticmethod
    def get_resource_usage_data() -> List[Dict[str, Any]]:
        """Get resource usage data for the last 24 hours."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get resource usage data for last 24 hours
                cursor.execute('''
                    SELECT id, timestamp, cpu_usage, memory_usage, disk_usage, 
                           active_users, concurrent_executions, ai_requests_per_minute
                    FROM resource_usage 
                    WHERE timestamp >= datetime('now', '-24 hours')
                    ORDER BY timestamp DESC
                    LIMIT 100
                ''')
                
                usage_data = cursor.fetchall()
                
                return [
                    {
                        'id': row[0],
                        'timestamp': row[1],
                        'cpu_usage': float(row[2]) if row[2] else 0,
                        'memory_usage': float(row[3]) if row[3] else 0,
                        'disk_usage': float(row[4]) if row[4] else 0,
                        'active_users': row[5] or 0,
                        'concurrent_executions': row[6] or 0,
                        'ai_requests_per_minute': row[7] or 0
                    }
                    for row in usage_data
                ]
                
        except Exception as e:
            logger.error(f"Error getting resource usage data: {str(e)}")
            return []

    @staticmethod
    def clear_logs(log_type: str) -> bool:
        """Clear logs of specified type."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                if log_type == 'system-logs':
                    cursor.execute('DELETE FROM system_logs')
                elif log_type == 'audit-logs':
                    cursor.execute('DELETE FROM audit_logs')
                else:
                    return False
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Error clearing logs: {str(e)}")
            return False

    @staticmethod
    def log_audit_event(admin_user_id: int, action: str, target_type: str, 
                       target_id: int, old_values: Optional[Dict] = None, 
                       new_values: Optional[Dict] = None, ip_address: Optional[str] = None):
        """Log an audit event."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO audit_logs (admin_user_id, action, target_type, target_id, 
                                          old_values, new_values, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    admin_user_id, action, target_type, target_id,
                    str(old_values) if old_values else None,
                    str(new_values) if new_values else None,
                    ip_address
                ))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to log audit event: {str(e)}")