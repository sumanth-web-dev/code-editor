"""
Authentication API routes.
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.auth_service import auth_service
from app.models.user import UserRole
from app.middleware.rate_limiter import rate_limit
import logging

logger = logging.getLogger(__name__)

# Create auth blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
@rate_limit(requests_per_minute=5, requests_per_hour=20)
def register():
    """
    Register a new user.
    
    Expected JSON payload:
    {
        "email": "user@example.com",
        "password": "password123",
        "first_name": "John",
        "last_name": "Doe",
        "role": "student"  // optional, defaults to student
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Empty request body'
            }), 400
        
        # Extract and validate data
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        role_str = data.get('role', 'student').strip().lower()
        
        # Validate required fields
        if not all([email, password, first_name, last_name]):
            return jsonify({
                'success': False,
                'error': 'Email, password, first name, and last name are required'
            }), 400
        
        # Validate email format
        if '@' not in email or '.' not in email:
            return jsonify({
                'success': False,
                'error': 'Invalid email format'
            }), 400
        
        # Validate role
        try:
            role = UserRole(role_str)
        except ValueError:
            role = UserRole.STUDENT
        
        # Register user
        success, message, user = auth_service.register_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role
        )
        
        if success:
            # Generate tokens
            tokens = auth_service.generate_tokens(user)
            
            # Create session
            session = auth_service.create_session(
                user=user,
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            )
            
            return jsonify({
                'success': True,
                'message': message,
                'user': user.to_dict(),
                'tokens': tokens,
                'session': session.to_dict()
            }), 201
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 400
            
    except Exception as e:
        logger.error(f"Error in register endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Registration failed'
        }), 500

@auth_bp.route('/login', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def login():
    """
    Authenticate user and return tokens.
    
    Expected JSON payload:
    {
        "email": "user@example.com",
        "password": "password123"
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Empty request body'
            }), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({
                'success': False,
                'error': 'Email and password are required'
            }), 400
        
        # Authenticate user
        success, message, user = auth_service.authenticate_user(email, password)
        
        if success:
            # Generate tokens
            tokens = auth_service.generate_tokens(user)
            
            # Create session
            session = auth_service.create_session(
                user=user,
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent')
            )
            
            return jsonify({
                'success': True,
                'message': message,
                'user': user.to_dict(),
                'tokens': tokens,
                'session': session.to_dict()
            })
        else:
            return jsonify({
                'success': False,
                'error': message
            }), 401
            
    except Exception as e:
        logger.error(f"Error in login endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Login failed'
        }), 500

@auth_bp.route('/refresh', methods=['POST'])
@rate_limit(requests_per_minute=20, requests_per_hour=100)
def refresh_token():
    """
    Refresh access token using refresh token.
    
    Expected JSON payload:
    {
        "refresh_token": "refresh_token_here"
    }
    """
    try:
        if not request.is_json:
            logger.error("Token refresh failed: Request is not JSON")
            return jsonify({
                'success': False,
                'error': 'Request must be JSON',
                'details': 'Content-Type must be application/json'
            }), 400

        data = request.get_json()
        refresh_token = data.get('refresh_token', '')

        if not refresh_token:
            logger.error("Token refresh failed: No refresh token provided")
            return jsonify({
                'success': False,
                'error': 'Refresh token is required',
                'details': 'Missing refresh_token in request body'
            }), 400

        logger.info(f"Attempting token refresh for token: {refresh_token[:8]}... (truncated)")
        success, tokens, error = auth_service.refresh_access_token(refresh_token)

        if success:
            logger.info("Token refresh successful")
            return jsonify({
                'success': True,
                'tokens': tokens
            })
        else:
            logger.error(f"Token refresh failed: {error}")
            return jsonify({
                'success': False,
                'error': error,
                'details': 'Token may be expired, invalid, or user inactive.'
            }), 401

    except Exception as e:
        logger.error(f"Exception in refresh_token endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Token refresh failed',
            'details': str(e)
        }), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Logout user and invalidate session.
    
    Expected JSON payload:
    {
        "session_token": "session_token_here"  // optional
    }
    """
    try:
        data = request.get_json() or {}
        session_token = data.get('session_token')
        
        # Logout user
        success = auth_service.logout_user(session_token)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Logged out successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Logout failed'
            }), 500
            
    except Exception as e:
        logger.error(f"Error in logout endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Logout failed'
        }), 500

@auth_bp.route('/forgot-password', methods=['POST'])
@rate_limit(requests_per_minute=3, requests_per_hour=10)
def forgot_password():
    """
    Request password reset token.
    
    Expected JSON payload:
    {
        "email": "user@example.com"
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({
                'success': False,
                'error': 'Email is required'
            }), 400
        
        # Create password reset token
        success, token, message = auth_service.create_password_reset_token(email)
        
        # Always return success for security (don't reveal if email exists)
        return jsonify({
            'success': True,
            'message': 'If the email exists, a reset link has been sent'
        })
        
    except Exception as e:
        logger.error(f"Error in forgot_password endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Password reset request failed'
        }), 500

@auth_bp.route('/reset-password', methods=['POST'])
@rate_limit(requests_per_minute=5, requests_per_hour=20)
def reset_password():
    """
    Reset password using reset token.
    
    Expected JSON payload:
    {
        "token": "reset_token_here",
        "new_password": "new_password123"
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        token = data.get('token', '')
        new_password = data.get('new_password', '')
        
        if not token or not new_password:
            return jsonify({
                'success': False,
                'error': 'Token and new password are required'
            }), 400
        
        # Reset password
        success, message = auth_service.reset_password(token, new_password)
        
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
        logger.error(f"Error in reset_password endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Password reset failed'
        }), 500

@auth_bp.route('/verify-email', methods=['POST'])
@rate_limit(requests_per_minute=10, requests_per_hour=50)
def verify_email():
    """
    Verify email using verification token.
    
    Expected JSON payload:
    {
        "token": "verification_token_here"
    }
    """
    try:
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must be JSON'
            }), 400
        
        data = request.get_json()
        token = data.get('token', '')
        
        if not token:
            return jsonify({
                'success': False,
                'error': 'Verification token is required'
            }), 400
        
        # Verify email
        success, message = auth_service.verify_email(token)
        
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
        logger.error(f"Error in verify_email endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Email verification failed'
        }), 500

@auth_bp.route('/profile', methods=['GET'])
@auth_service.require_auth()
def get_profile():
    """Get current user profile."""
    try:
        user_data = request.current_user
        
        # In real implementation, fetch full user data from database
        return jsonify({
            'success': True,
            'user': {
                'id': user_data['user_id'],
                'email': user_data['email'],
                'role': user_data['role']
                # Add more user fields as needed
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_profile endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get profile'
        }), 500

@auth_bp.route('/profile', methods=['PUT'])
@auth_service.require_auth()
def update_profile():
    """
    Update user profile.
    
    Expected JSON payload:
    {
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+1234567890",
        "country": "US"
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
        
        # In real implementation, fetch user from database and update
        # For now, just return success
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error in update_profile endpoint: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Profile update failed'
        }), 500