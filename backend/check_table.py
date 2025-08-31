#!/usr/bin/env python3
"""
Check if user_daily_usage table exists and show its structure.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')

def check_table():
    """Check the user_daily_usage table."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if table exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='user_daily_usage'
            """)
            
            if not cursor.fetchone():
                print("❌ user_daily_usage table does not exist!")
                return False
            
            print("✅ user_daily_usage table exists!")
            
            # Show table structure
            cursor.execute("PRAGMA table_info(user_daily_usage)")
            columns = cursor.fetchall()
            
            print("\nTable structure:")
            print("-" * 60)
            for col in columns:
                nullable = "NOT NULL" if col[3] else "NULL"
                print(f"{col[1]:20} | {col[2]:15} | {nullable}")
            print("-" * 60)
            
            # Show sample data
            cursor.execute("SELECT COUNT(*) FROM user_daily_usage")
            count = cursor.fetchone()[0]
            print(f"\nRows in table: {count}")
            
            if count > 0:
                cursor.execute("SELECT * FROM user_daily_usage LIMIT 5")
                rows = cursor.fetchall()
                print("\nSample data:")
                for row in rows:
                    print(row)
            
    except Exception as e:
        print(f"❌ Error checking table: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    print(f"Database path: {DB_PATH}")
    check_table()