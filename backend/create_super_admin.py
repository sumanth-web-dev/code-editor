#!/usr/bin/env python3
"""
Script to create a super admin account.
"""

import sys
import os
import getpass
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import get_db_connection, init_database
from app.models.user import User, UserRole

def create_super_admin():
    """Create a super admin account."""
    print("🔐 Creating Super Admin Account")
    print("=" * 40)
    
    # Initialize database first
    try:
        init_database()
        print("✅ Database initialized")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False
    
    # Get admin details
    email = input("Enter admin email: ").strip()
    if not email:
        print("❌ Email is required")
        return False
    
    first_name = input("Enter first name: ").strip()
    if not first_name:
        print("❌ First name is required")
        return False
    
    last_name = input("Enter last name: ").strip()
    if not last_name:
        print("❌ Last name is required")
        return False
    
    # Get password securely
    while True:
        password = getpass.getpass("Enter password: ")
        if len(password) < 8:
            print("❌ Password must be at least 8 characters long")
            continue
        
        confirm_password = getpass.getpass("Confirm password: ")
        if password != confirm_password:
            print("❌ Passwords don't match")
            continue
        
        break
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if user already exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                print(f"❌ User with email {email} already exists")
                return False
            
            # Create user
            user = User.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.ADMIN
            )
            
            # Insert into database
            cursor.execute('''
                INSERT INTO users 
                (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user.email,
                user.password_hash,
                user.first_name,
                user.last_name,
                user.role.value,
                user.is_active,
                True,  # Auto-verify admin email
                user.created_at.isoformat(),
                user.updated_at.isoformat()
            ))
            
            user_id = cursor.lastrowid
            conn.commit()
            
            print(f"✅ Super admin account created successfully!")
            print(f"   User ID: {user_id}")
            print(f"   Email: {email}")
            print(f"   Name: {first_name} {last_name}")
            print(f"   Role: {user.role.value}")
            print(f"   Status: Active & Email Verified")
            print()
            print("🎉 You can now login with these credentials!")
            
            return True
            
    except Exception as e:
        print(f"❌ Error creating super admin: {e}")
        return False

if __name__ == "__main__":
    success = create_super_admin()
    sys.exit(0 if success else 1)