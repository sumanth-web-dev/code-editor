"""
Authentication service for user management and JWT token handling.
"""

import jwt
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any
from flask import current_app, request, session
from app.models.user import User, UserSession, UserRole, PasswordResetToken, EmailVerificationToken
import logging

logger = logging.getLogger(__name__)

class AuthService:
    """Service for handling authentication operations."""
    
    def __init__(self):
        self.jwt_secret = None
        self.jwt_algorithm = 'HS256'
        self.access_token_expires = timedelta(hours=1)
        self.refresh_token_expires = timedelta(days=7)
        # Simple in-memory user store for testing (replace with database in production)
        self.users = {}
        self.user_id_counter = 1
    
    def initialize(self, app):
        """Initialize the auth service with Flask app configuration."""
        self.jwt_secret = app.config.get('JWT_SECRET_KEY', app.config.get('SECRET_KEY'))
        if not self.jwt_secret:
            raise ValueError("JWT_SECRET_KEY or SECRET_KEY must be configured")
    
    def register_user(self, email: str, password: str, first_name: str, 
                     last_name: str, role: UserRole = UserRole.STUDENT) -> Tuple[bool, str, Optional[User]]:
        """
        Register a new user.
        
        Returns:
            Tuple of (success, message, user)
        """
        try:
            # Validate input
            if not email or not password or not first_name or not last_name:
                return False, "All fields are required", None
            
            if len(password) < 8:
                return False, "Password must be at least 8 characters long", None
            
            # Check if user already exists
            if email in self.users:
                return False, "User with this email already exists", None
            
            # Create user
            user = User.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=role
            )
            
            # Assign ID and store user
            user.id = self.user_id_counter
            self.user_id_counter += 1
            self.users[email] = user
            
            logger.info(f"User registered successfully: {email}")
            
            return True, "User registered successfully", user
            
        except Exception as e:
            logger.error(f"Error registering user: {str(e)}")
            return False, f"Registration failed: {str(e)}", None
    
    def authenticate_user(self, email: str, password: str) -> Tuple[bool, str, Optional[User]]:
        """
        Authenticate a user with email and password.
        
        Returns:
            Tuple of (success, message, user)
        """
        try:
            if not email or not password:
                return False, "Email and password are required", None
            
            # Fetch user from database
            from app.database.connection import get_db_connection
            import bcrypt
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT id, email, password_hash, first_name, last_name, role, is_active, email_verified FROM users WHERE email = ?',
                    (email,)
                )
                user_row = cursor.fetchone()
                
                if not user_row:
                    return False, "Invalid email or password", None
                
                # Check if account is active
                if not user_row['is_active']:
                    return False, "Account is deactivated", None
                
                # Verify password
                if not bcrypt.checkpw(password.encode('utf-8'), user_row['password_hash'].encode('utf-8')):
                    return False, "Invalid email or password", None
                
                # Create user object
                user = User(
                    id=user_row['id'],
                    email=user_row['email'],
                    first_name=user_row['first_name'],
                    last_name=user_row['last_name'],
                    role=UserRole(user_row['role']),
                    is_active=bool(user_row['is_active']),
                    email_verified=bool(user_row['email_verified'])
                )
                
                # Update last login
                cursor.execute(
                    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    (user.id,)
                )
                conn.commit()
                
                logger.info(f"User authenticated successfully: {email}")
                return True, "Authentication successful", user
            
        except Exception as e:
            logger.error(f"Error authenticating user: {str(e)}")
            return False, f"Authentication failed: {str(e)}", None
    
    def generate_tokens(self, user: User) -> Dict[str, str]:
        """
        Generate JWT access and refresh tokens for a user.
        
        Returns:
            Dictionary with access_token and refresh_token
        """
        try:
            now = datetime.utcnow()
            
            # Access token payload
            access_payload = {
                'user_id': user.id,
                'email': user.email,
                'role': user.role.value if isinstance(user.role, UserRole) else user.role,
                'iat': now,
                'exp': now + self.access_token_expires,
                'type': 'access'
            }
            
            # Refresh token payload
            refresh_payload = {
                'user_id': user.id,
                'iat': now,
                'exp': now + self.refresh_token_expires,
                'type': 'refresh',
                'jti': secrets.token_urlsafe(16)  # Unique token ID
            }
            
            access_token = jwt.encode(access_payload, self.jwt_secret, algorithm=self.jwt_algorithm)
            refresh_token = jwt.encode(refresh_payload, self.jwt_secret, algorithm=self.jwt_algorithm)
            
            return {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'token_type': 'Bearer',
                'expires_in': int(self.access_token_expires.total_seconds())
            }
            
        except Exception as e:
            logger.error(f"Error generating tokens: {str(e)}")
            raise
    
    def verify_token(self, token: str, token_type: str = 'access') -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """
        Verify and decode a JWT token.
        
        Returns:
            Tuple of (is_valid, payload, error_message)
        """
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            
            # Check token type
            if payload.get('type') != token_type:
                return False, None, f"Invalid token type. Expected {token_type}"
            
            # Check expiration
            if datetime.utcnow() > datetime.fromtimestamp(payload['exp']):
                return False, None, "Token has expired"
            
            return True, payload, ""
            
        except jwt.ExpiredSignatureError:
            return False, None, "Token has expired"
        except jwt.InvalidTokenError as e:
            return False, None, f"Invalid token: {str(e)}"
        except Exception as e:
            logger.error(f"Error verifying token: {str(e)}")
            return False, None, f"Token verification failed: {str(e)}"
    
    def refresh_access_token(self, refresh_token: str) -> Tuple[bool, Optional[Dict[str, str]], str]:
        """
        Generate a new access token using a refresh token.
        
        Returns:
            Tuple of (success, tokens_dict, error_message)
        """
        try:
            # Verify refresh token
            is_valid, payload, error = self.verify_token(refresh_token, 'refresh')
            if not is_valid:
                return False, None, error
            
            # Find user by ID in in-memory store
            user_id = payload['user_id']
            user = None
            for stored_user in self.users.values():
                if stored_user.id == user_id:
                    user = stored_user
                    break
            
            if not user or not user.is_active:
                return False, None, "User not found or inactive"
            
            # Generate new tokens
            tokens = self.generate_tokens(user)
            return True, tokens, ""
            
        except Exception as e:
            logger.error(f"Error refreshing token: {str(e)}")
            return False, None, f"Token refresh failed: {str(e)}"
    
    def create_session(self, user: User, ip_address: str = None, 
                      user_agent: str = None) -> UserSession:
        """Create a new user session."""
        return UserSession.create_session(
            user_id=user.id,
            ip_address=ip_address or request.remote_addr,
            user_agent=user_agent or request.headers.get('User-Agent', '')
        )
    
    def logout_user(self, session_token: str = None) -> bool:
        """
        Logout a user by invalidating their session.
        
        Returns:
            True if logout successful
        """
        try:
            # Clear Flask session
            session.clear()
            
            # In a real implementation, invalidate session in database
            if session_token:
                # Mark session as inactive in database
                pass
            
            logger.info("User logged out successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error during logout: {str(e)}")
            return False
    
    def create_password_reset_token(self, email: str) -> Tuple[bool, Optional[PasswordResetToken], str]:
        """
        Create a password reset token for a user.
        
        Returns:
            Tuple of (success, token, message)
        """
        try:
            # In a real implementation, fetch user from database
            user = None  # This would be fetched from database by email
            
            if not user:
                # Don't reveal if email exists or not for security
                return True, None, "If the email exists, a reset link has been sent"
            
            # Create reset token
            reset_token = PasswordResetToken.create_token(user.id)
            
            # In a real implementation, save token to database and send email
            logger.info(f"Password reset token created for user: {email}")
            
            return True, reset_token, "Password reset link has been sent to your email"
            
        except Exception as e:
            logger.error(f"Error creating password reset token: {str(e)}")
            return False, None, f"Failed to create reset token: {str(e)}"
    
    def reset_password(self, token: str, new_password: str) -> Tuple[bool, str]:
        """
        Reset user password using a reset token.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            if len(new_password) < 8:
                return False, "Password must be at least 8 characters long"
            
            # In a real implementation, fetch and validate token from database
            reset_token = None  # This would be fetched from database
            
            if not reset_token or not reset_token.is_valid():
                return False, "Invalid or expired reset token"
            
            # In a real implementation, fetch user and update password
            user = None  # This would be fetched from database
            
            if not user:
                return False, "User not found"
            
            # Update password
            user.password_hash = User.hash_password(new_password)
            user.updated_at = datetime.utcnow()
            
            # Mark token as used
            reset_token.used = True
            
            # In a real implementation, save changes to database
            logger.info(f"Password reset successfully for user: {user.email}")
            
            return True, "Password reset successfully"
            
        except Exception as e:
            logger.error(f"Error resetting password: {str(e)}")
            return False, f"Password reset failed: {str(e)}"
    
    def create_email_verification_token(self, user: User) -> EmailVerificationToken:
        """Create an email verification token for a user."""
        return EmailVerificationToken.create_token(user.id)
    
    def verify_email(self, token: str) -> Tuple[bool, str]:
        """
        Verify user email using a verification token.
        
        Returns:
            Tuple of (success, message)
        """
        try:
            # In a real implementation, fetch and validate token from database
            verification_token = None  # This would be fetched from database
            
            if not verification_token or not verification_token.is_valid():
                return False, "Invalid or expired verification token"
            
            # In a real implementation, fetch user and update email_verified
            user = None  # This would be fetched from database
            
            if not user:
                return False, "User not found"
            
            # Mark email as verified
            user.email_verified = True
            user.updated_at = datetime.utcnow()
            
            # Mark token as used
            verification_token.used = True
            
            # In a real implementation, save changes to database
            logger.info(f"Email verified successfully for user: {user.email}")
            
            return True, "Email verified successfully"
            
        except Exception as e:
            logger.error(f"Error verifying email: {str(e)}")
            return False, f"Email verification failed: {str(e)}"
    
    def require_auth(self, required_role: UserRole = None):
        """
        Decorator to require authentication for routes.
        
        Args:
            required_role: Minimum role required (optional)
        """
        def decorator(f):
            def wrapper(*args, **kwargs):
                # Get token from Authorization header
                auth_header = request.headers.get('Authorization')
                if not auth_header or not auth_header.startswith('Bearer '):
                    return {'error': 'Authentication required'}, 401
                
                token = auth_header.split(' ')[1]
                is_valid, payload, error = self.verify_token(token)
                
                if not is_valid:
                    return {'error': error}, 401
                
                # Check role if required
                if required_role:
                    user_role = UserRole(payload.get('role', 'student'))
                    if not self._has_required_role(user_role, required_role):
                        return {'error': 'Insufficient permissions'}, 403
                
                # Add user info to request context
                request.current_user = payload
                
                return f(*args, **kwargs)
            
            wrapper.__name__ = f.__name__
            return wrapper
        return decorator
    
    def _has_required_role(self, user_role: UserRole, required_role: UserRole) -> bool:
        """Check if user role meets the required role."""
        role_hierarchy = {
            UserRole.STUDENT: 1,
            UserRole.EDITOR: 2,
            UserRole.ADMIN: 3
        }
        
        return role_hierarchy.get(user_role, 0) >= role_hierarchy.get(required_role, 0)

# Global auth service instance
auth_service = AuthService()