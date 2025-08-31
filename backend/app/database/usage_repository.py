"""
Repository for tracking and resetting daily usage for free plan features.
"""

from datetime import datetime, timedelta, time
from typing import Dict, Any
from app.database.connection import get_db_connection, USE_MYSQL
import logging

logger = logging.getLogger(__name__)

class UsageRepository:
    """Repository for user usage tracking and daily reset."""

    @staticmethod
    def get_user_usage_today(user_id: int) -> Dict[str, int]:
        """Get today's usage for a user."""
        with get_db_connection() as conn:
            today = datetime.now().date().isoformat()
            
            if USE_MYSQL:
                # MySQL version
                from sqlalchemy import text
                result = conn.execute(text('''
                    SELECT ai_analysis_count, code_generation_count FROM user_daily_usage
                    WHERE user_id = :user_id AND usage_date = :usage_date
                '''), {'user_id': user_id, 'usage_date': today})
                row = result.fetchone()
                if row:
                    return {'ai_analysis': row[0], 'code_generation': row[1]}
            else:
                # SQLite version
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT ai_analysis_count, code_generation_count FROM user_daily_usage
                    WHERE user_id = ? AND usage_date = ?
                ''', (user_id, today))
                row = cursor.fetchone()
                if row:
                    return {'ai_analysis': row[0], 'code_generation': row[1]}
            
            return {'ai_analysis': 0, 'code_generation': 0}

    @staticmethod
    def increment_usage(user_id: int, action_type: str):
        """Increment usage count for a user and action type."""
        with get_db_connection() as conn:
            today = datetime.now().date().isoformat()
            
            if USE_MYSQL:
                # MySQL version
                from sqlalchemy import text
                
                # Check if record exists
                result = conn.execute(text('''
                    SELECT ai_analysis_count, code_generation_count FROM user_daily_usage
                    WHERE user_id = :user_id AND usage_date = :usage_date
                '''), {'user_id': user_id, 'usage_date': today})
                row = result.fetchone()
                
                if row:
                    if action_type == 'ai_analysis':
                        conn.execute(text('''
                            UPDATE user_daily_usage SET ai_analysis_count = ai_analysis_count + 1
                            WHERE user_id = :user_id AND usage_date = :usage_date
                        '''), {'user_id': user_id, 'usage_date': today})
                    elif action_type == 'code_generation':
                        conn.execute(text('''
                            UPDATE user_daily_usage SET code_generation_count = code_generation_count + 1
                            WHERE user_id = :user_id AND usage_date = :usage_date
                        '''), {'user_id': user_id, 'usage_date': today})
                else:
                    ai_count = 1 if action_type == 'ai_analysis' else 0
                    code_count = 1 if action_type == 'code_generation' else 0
                    conn.execute(text('''
                        INSERT INTO user_daily_usage (user_id, usage_date, ai_analysis_count, code_generation_count)
                        VALUES (:user_id, :usage_date, :ai_count, :code_count)
                    '''), {'user_id': user_id, 'usage_date': today, 'ai_count': ai_count, 'code_count': code_count})
                
                conn.commit()
            else:
                # SQLite version
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT ai_analysis_count, code_generation_count FROM user_daily_usage
                    WHERE user_id = ? AND usage_date = ?
                ''', (user_id, today))
                row = cursor.fetchone()
                if row:
                    if action_type == 'ai_analysis':
                        cursor.execute('''
                            UPDATE user_daily_usage SET ai_analysis_count = ai_analysis_count + 1
                            WHERE user_id = ? AND usage_date = ?
                        ''', (user_id, today))
                    elif action_type == 'code_generation':
                        cursor.execute('''
                            UPDATE user_daily_usage SET code_generation_count = code_generation_count + 1
                            WHERE user_id = ? AND usage_date = ?
                        ''', (user_id, today))
                else:
                    ai_count = 1 if action_type == 'ai_analysis' else 0
                    code_count = 1 if action_type == 'code_generation' else 0
                    cursor.execute('''
                        INSERT INTO user_daily_usage (user_id, usage_date, ai_analysis_count, code_generation_count)
                        VALUES (?, ?, ?, ?)
                    ''', (user_id, today, ai_count, code_count))
                conn.commit()

    @staticmethod
    def reset_all_usage():
        """Reset all user usage counts (run daily at midnight IST)."""
        with get_db_connection() as conn:
            if USE_MYSQL:
                # MySQL version
                from sqlalchemy import text
                conn.execute(text('DELETE FROM user_daily_usage'))
                conn.commit()
            else:
                # SQLite version
                cursor = conn.cursor()
                cursor.execute('DELETE FROM user_daily_usage')
                conn.commit()
            logger.info('Reset all user daily usage counts.')
