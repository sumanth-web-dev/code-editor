#!/usr/bin/env python3
"""
Quick setup script to create a super admin account.
"""

import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import get_db_connection, init_database
from app.models.user import User, UserRole
from datetime import datetime

def setup_admin():
    """Setup a default super admin account."""
    print("🚀 Setting up Super Admin Account")
    print("=" * 40)
    
    # Initialize database first
    try:
        init_database()
        print("✅ Database initialized")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False
    
    # Default admin credentials
    admin_email = "admin@codeplatform.com"
    admin_password = "admin123"
    admin_first_name = "Super"
    admin_last_name = "Admin"
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if admin already exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (admin_email,))
            existing_admin = cursor.fetchone()
            
            if existing_admin:
                print(f"✅ Super admin already exists with email: {admin_email}")
                print(f"   User ID: {existing_admin['id']}")
                print(f"   Password: {admin_password}")
                return True
            
            # Create admin user
            admin_user = User.create_user(
                email=admin_email,
                password=admin_password,
                first_name=admin_first_name,
                last_name=admin_last_name,
                role=UserRole.ADMIN
            )
            
            # Insert into database
            cursor.execute('''
                INSERT INTO users 
                (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                admin_user.email,
                admin_user.password_hash,
                admin_user.first_name,
                admin_user.last_name,
                admin_user.role.value,
                admin_user.is_active,
                True,  # Auto-verify admin email
                admin_user.created_at.isoformat(),
                admin_user.updated_at.isoformat()
            ))
            
            user_id = cursor.lastrowid
            conn.commit()
            
            print(f"✅ Super admin account created successfully!")
            print(f"   User ID: {user_id}")
            print(f"   Email: {admin_email}")
            print(f"   Password: {admin_password}")
            print(f"   Name: {admin_first_name} {admin_last_name}")
            print(f"   Role: {admin_user.role.value}")
            print(f"   Status: Active & Email Verified")
            print()
            print("🎉 You can now login with these credentials!")
            print("⚠️  Remember to change the password after first login!")
            
            return True
            
    except Exception as e:
        print(f"❌ Error creating super admin: {e}")
        return False

if __name__ == "__main__":
    success = setup_admin()
    sys.exit(0 if success else 1)