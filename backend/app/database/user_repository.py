"""
Repository for user database operations.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from app.database.connection import get_db_connection
from app.models.user import User, UserRole
import logging

logger = logging.getLogger(__name__)

class UserRepository:
    """Repository for user operations."""
    
    @staticmethod
    def get_user_by_id(user_id: int) -> Optional[User]:
        """Get a user by ID."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
                row = cursor.fetchone()
                
                if row:
                    return UserRepository._row_to_user(row)
                return None
                
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {str(e)}")
            return None
    
    @staticmethod
    def get_user_by_email(email: str) -> Optional[User]:
        """Get a user by email."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users WHERE email = ?", (email.lower(),))
                row = cursor.fetchone()
                
                if row:
                    return UserRepository._row_to_user(row)
                return None
                
        except Exception as e:
            logger.error(f"Error getting user by email {email}: {str(e)}")
            return None
    
    @staticmethod
    def create_user(user: User) -> Optional[int]:
        """Create a new user."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO users 
                    (email, password_hash, first_name, last_name, role, is_active, 
                     email_verified, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user.email,
                    user.password_hash,
                    user.first_name,
                    user.last_name,
                    user.role.value,
                    user.is_active,
                    user.email_verified,
                    user.created_at.isoformat() if user.created_at else datetime.utcnow().isoformat(),
                    user.updated_at.isoformat() if user.updated_at else datetime.utcnow().isoformat()
                ))
                
                user_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"Created user with ID: {user_id}")
                return user_id
                
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            return None
    
    @staticmethod
    def update_user(user_id: int, user_data: Dict[str, Any]) -> bool:
        """Update an existing user."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Build update query dynamically
                update_fields = []
                params = []
                
                if 'first_name' in user_data:
                    update_fields.append('first_name = ?')
                    params.append(user_data['first_name'])
                
                if 'last_name' in user_data:
                    update_fields.append('last_name = ?')
                    params.append(user_data['last_name'])
                
                if 'email' in user_data:
                    update_fields.append('email = ?')
                    params.append(user_data['email'].lower())
                
                if 'role' in user_data:
                    update_fields.append('role = ?')
                    params.append(user_data['role'])
                
                if 'is_active' in user_data:
                    update_fields.append('is_active = ?')
                    params.append(user_data['is_active'])
                
                if 'email_verified' in user_data:
                    update_fields.append('email_verified = ?')
                    params.append(user_data['email_verified'])
                
                update_fields.append('updated_at = ?')
                params.append(datetime.utcnow().isoformat())
                
                params.append(user_id)
                
                query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
                cursor.execute(query, params)
                
                conn.commit()
                
                logger.info(f"Updated user {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {str(e)}")
            return False
    
    @staticmethod
    def update_last_login(user_id: int) -> bool:
        """Update user's last login timestamp."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE users 
                    SET last_login = ?, updated_at = ? 
                    WHERE id = ?
                ''', (
                    datetime.utcnow().isoformat(),
                    datetime.utcnow().isoformat(),
                    user_id
                ))
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Error updating last login for user {user_id}: {str(e)}")
            return False
    
    @staticmethod
    def get_all_users(limit: int = 100, offset: int = 0) -> List[User]:
        """Get all users with pagination."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM users 
                    ORDER BY created_at DESC 
                    LIMIT ? OFFSET ?
                ''', (limit, offset))
                rows = cursor.fetchall()
                
                users = []
                for row in rows:
                    user = UserRepository._row_to_user(row)
                    users.append(user)
                
                return users
                
        except Exception as e:
            logger.error(f"Error getting all users: {str(e)}")
            return []
    
    @staticmethod
    def search_users(query: str, limit: int = 50) -> List[User]:
        """Search users by name or email."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                search_pattern = f"%{query.lower()}%"
                cursor.execute('''
                    SELECT * FROM users 
                    WHERE LOWER(email) LIKE ? 
                       OR LOWER(first_name) LIKE ? 
                       OR LOWER(last_name) LIKE ?
                    ORDER BY created_at DESC 
                    LIMIT ?
                ''', (search_pattern, search_pattern, search_pattern, limit))
                rows = cursor.fetchall()
                
                users = []
                for row in rows:
                    user = UserRepository._row_to_user(row)
                    users.append(user)
                
                return users
                
        except Exception as e:
            logger.error(f"Error searching users: {str(e)}")
            return []
    
    @staticmethod
    def delete_user(user_id: int) -> bool:
        """Delete a user (soft delete by setting inactive)."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Soft delete - just deactivate
                cursor.execute('''
                    UPDATE users 
                    SET is_active = 0, updated_at = ? 
                    WHERE id = ?
                ''', (datetime.utcnow().isoformat(), user_id))
                
                conn.commit()
                
                logger.info(f"Deleted (deactivated) user {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting user {user_id}: {str(e)}")
            return False
    
    @staticmethod
    def get_user_stats() -> Dict[str, Any]:
        """Get user statistics for admin dashboard."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Total users
                cursor.execute("SELECT COUNT(*) FROM users")
                total_users = cursor.fetchone()[0]
                
                # Active users
                cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = 1")
                active_users = cursor.fetchone()[0]
                
                # Users by role
                cursor.execute('''
                    SELECT role, COUNT(*) as count 
                    FROM users 
                    WHERE is_active = 1 
                    GROUP BY role
                ''')
                users_by_role = dict(cursor.fetchall())
                
                # Recent users (last 7 days)
                cursor.execute('''
                    SELECT COUNT(*) FROM users 
                    WHERE created_at >= datetime('now', '-7 days')
                ''')
                recent_users = cursor.fetchone()[0]
                
                return {
                    'total_users': total_users,
                    'active_users': active_users,
                    'users_by_role': users_by_role,
                    'recent_users': recent_users
                }
                
        except Exception as e:
            logger.error(f"Error getting user stats: {str(e)}")
            return {
                'total_users': 0,
                'active_users': 0,
                'users_by_role': {},
                'recent_users': 0
            }
    
    @staticmethod
    def _row_to_user(row) -> User:
        """Convert database row to User object."""
        role = UserRole.STUDENT
        try:
            role = UserRole(row['role'])
        except ValueError:
            pass
        
        return User(
            id=row['id'],
            email=row['email'],
            password_hash=row['password_hash'],
            first_name=row['first_name'] or '',
            last_name=row['last_name'] or '',
            role=role,
            is_active=bool(row['is_active']),
            email_verified=bool(row['email_verified']),
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None,
            updated_at=datetime.fromisoformat(row['updated_at']) if row['updated_at'] else None,
            last_login=datetime.fromisoformat(row['last_login']) if row['last_login'] else None
        )