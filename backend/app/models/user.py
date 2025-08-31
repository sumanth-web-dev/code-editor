"""
User model for authentication and user management.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
import secrets
from dataclasses import dataclass
from enum import Enum

class UserRole(Enum):
    STUDENT = "student"
    EDITOR = "editor"
    ADMIN = "admin"

@dataclass
class User:
    """User model for the application."""
    id: Optional[int] = None
    email: str = ""
    password_hash: str = ""
    first_name: str = ""
    last_name: str = ""
    role: UserRole = UserRole.STUDENT
    is_active: bool = True
    email_verified: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    profile_picture_url: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    country: Optional[str] = None
    timezone: str = "UTC"
    
    @classmethod
    def create_user(cls, email: str, password: str, first_name: str, last_name: str, 
                   role: UserRole = UserRole.STUDENT) -> 'User':
        """Create a new user with hashed password."""
        password_hash = cls.hash_password(password)
        return cls(
            email=email.lower().strip(),
            password_hash=password_hash,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            role=role,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt."""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def verify_password(self, password: str) -> bool:
        """Verify a password against the stored hash."""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def update_last_login(self):
        """Update the last login timestamp."""
        self.last_login = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def to_dict(self, include_sensitive: bool = False) -> Dict[str, Any]:
        """Convert user to dictionary representation."""
        data = {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': f"{self.first_name} {self.last_name}".strip(),
            'role': self.role.value if isinstance(self.role, UserRole) else self.role,
            'is_active': self.is_active,
            'email_verified': self.email_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'profile_picture_url': self.profile_picture_url,
            'phone': self.phone,
            'country': self.country,
            'timezone': self.timezone
        }
        
        if include_sensitive:
            data.update({
                'password_hash': self.password_hash,
                'updated_at': self.updated_at.isoformat() if self.updated_at else None,
                'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None
            })
        
        return data
    
    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission based on role."""
        permissions = {
            UserRole.STUDENT: ['code_execution', 'ai_analysis', 'view_profile'],
            UserRole.EDITOR: ['code_execution', 'ai_analysis', 'view_profile', 'advanced_features'],
            UserRole.ADMIN: ['*']  # Admin has all permissions
        }
        
        user_permissions = permissions.get(self.role, [])
        return '*' in user_permissions or permission in user_permissions
    
    def is_admin(self) -> bool:
        """Check if user is an admin."""
        return self.role == UserRole.ADMIN
    
    def is_editor(self) -> bool:
        """Check if user is an editor or admin."""
        return self.role in [UserRole.EDITOR, UserRole.ADMIN]

@dataclass
class UserSession:
    """User session model for JWT token management."""
    id: Optional[int] = None
    user_id: int = 0
    session_token: str = ""
    refresh_token: str = ""
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    last_accessed: Optional[datetime] = None
    is_active: bool = True
    
    @classmethod
    def create_session(cls, user_id: int, ip_address: str = None, 
                      user_agent: str = None, expires_in_hours: int = 24) -> 'UserSession':
        """Create a new user session."""
        now = datetime.utcnow()
        return cls(
            user_id=user_id,
            session_token=secrets.token_urlsafe(32),
            refresh_token=secrets.token_urlsafe(32),
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=now + timedelta(hours=expires_in_hours),
            created_at=now,
            last_accessed=now
        )
    
    def is_expired(self) -> bool:
        """Check if session is expired."""
        return datetime.utcnow() > self.expires_at
    
    def refresh(self, expires_in_hours: int = 24):
        """Refresh the session with new expiry time."""
        self.expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)
        self.last_accessed = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert session to dictionary representation."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'session_token': self.session_token,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
            'is_active': self.is_active,
            'ip_address': self.ip_address
        }

@dataclass
class PasswordResetToken:
    """Password reset token model."""
    id: Optional[int] = None
    user_id: int = 0
    token: str = ""
    expires_at: Optional[datetime] = None
    used: bool = False
    created_at: Optional[datetime] = None
    
    @classmethod
    def create_token(cls, user_id: int, expires_in_hours: int = 1) -> 'PasswordResetToken':
        """Create a new password reset token."""
        now = datetime.utcnow()
        return cls(
            user_id=user_id,
            token=secrets.token_urlsafe(32),
            expires_at=now + timedelta(hours=expires_in_hours),
            created_at=now
        )
    
    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)."""
        return not self.used and not self.is_expired()

@dataclass
class EmailVerificationToken:
    """Email verification token model."""
    id: Optional[int] = None
    user_id: int = 0
    token: str = ""
    expires_at: Optional[datetime] = None
    used: bool = False
    created_at: Optional[datetime] = None
    
    @classmethod
    def create_token(cls, user_id: int, expires_in_hours: int = 24) -> 'EmailVerificationToken':
        """Create a new email verification token."""
        now = datetime.utcnow()
        return cls(
            user_id=user_id,
            token=secrets.token_urlsafe(32),
            expires_at=now + timedelta(hours=expires_in_hours),
            created_at=now
        )
    
    def is_expired(self) -> bool:
        """Check if token is expired."""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)."""
        return not self.used and not self.is_expired()