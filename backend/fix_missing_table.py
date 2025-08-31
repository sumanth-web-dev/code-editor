#!/usr/bin/env python3
"""
Fix missing user_daily_usage table in the database.
"""

import sqlite3
import os
import sys
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import DB_PATH

def create_user_daily_usage_table():
    """Create the missing user_daily_usage table."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            print("Creating user_daily_usage table...")
            
            # Check if table already exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='user_daily_usage'
            """)
            
            if cursor.fetchone():
                print("✓ user_daily_usage table already exists")
                return True
            
            # Create the user_daily_usage table
            cursor.execute('''
                CREATE TABLE user_daily_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    usage_date DATE NOT NULL,
                    ai_analysis_count INTEGER DEFAULT 0,
                    code_generation_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    UNIQUE(user_id, usage_date)
                )
            ''')
            
            # Create index for better performance
            cursor.execute('''
                CREATE INDEX idx_user_daily_usage_user_date 
                ON user_daily_usage(user_id, usage_date)
            ''')
            
            conn.commit()
            print("✅ user_daily_usage table created successfully!")
            
            # Display table structure
            cursor.execute("PRAGMA table_info(user_daily_usage)")
            columns = cursor.fetchall()
            
            print("\nTable structure:")
            print("-" * 50)
            for col in columns:
                print(f"{col[1]:20} | {col[2]:15} | {'NOT NULL' if col[3] else 'NULL'}")
            print("-" * 50)
            
    except Exception as e:
        print(f"❌ Error creating user_daily_usage table: {str(e)}")
        return False
    
    return True

def backup_database():
    """Create a backup of the database before updating."""
    try:
        backup_path = f"{DB_PATH}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Copy database file
        import shutil
        shutil.copy2(DB_PATH, backup_path)
        
        print(f"✓ Database backed up to: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"❌ Error creating backup: {str(e)}")
        return None

if __name__ == "__main__":
    print("🔄 Fixing missing user_daily_usage table...")
    print(f"Database path: {DB_PATH}")
    
    # Check if database exists
    if not os.path.exists(DB_PATH):
        print("❌ Database file not found. Please run the application first to create the database.")
        sys.exit(1)
    
    # Create backup
    backup_path = backup_database()
    if not backup_path:
        print("❌ Failed to create backup. Aborting update.")
        sys.exit(1)
    
    # Create missing table
    if create_user_daily_usage_table():
        print("\n🎉 Missing table fix completed successfully!")
        print(f"💾 Backup saved at: {backup_path}")
    else:
        print("\n❌ Failed to create missing table!")
        sys.exit(1)