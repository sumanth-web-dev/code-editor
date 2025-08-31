#!/usr/bin/env python3
"""
Database schema update script to add AI analysis limits and convert currency to INR.
"""

import sqlite3
import os
import sys
from datetime import datetime

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import DB_PATH

def update_database_schema():
    """Update database schema to add AI analysis limits and convert currency."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            print("Updating database schema...")
            
            # Check if ai_analysis_limit column exists
            cursor.execute("PRAGMA table_info(subscription_plans)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'ai_analysis_limit' not in columns:
                print("Adding ai_analysis_limit column to subscription_plans...")
                cursor.execute('''
                    ALTER TABLE subscription_plans 
                    ADD COLUMN ai_analysis_limit INTEGER DEFAULT 10
                ''')
                
                # Update existing plans with appropriate AI analysis limits
                cursor.execute('''
                    UPDATE subscription_plans 
                    SET ai_analysis_limit = CASE 
                        WHEN name LIKE '%Basic%' THEN 10
                        WHEN name LIKE '%Premium%' THEN 50
                        WHEN name LIKE '%Annual%' THEN 600
                        ELSE 10
                    END
                ''')
                print("✓ Added ai_analysis_limit column and updated existing plans")
            else:
                print("✓ ai_analysis_limit column already exists")
            
            # Update currency from USD to INR and convert prices
            cursor.execute("SELECT id, price, currency FROM subscription_plans WHERE currency = 'USD'")
            usd_plans = cursor.fetchall()
            
            if usd_plans:
                print(f"Converting {len(usd_plans)} plans from USD to INR...")
                for plan_id, price, currency in usd_plans:
                    # Convert USD to INR (approximate rate: 1 USD = 83 INR)
                    inr_price = price * 83.0
                    cursor.execute('''
                        UPDATE subscription_plans 
                        SET price = ?, currency = 'INR' 
                        WHERE id = ?
                    ''', (inr_price, plan_id))
                    print(f"  Plan {plan_id}: ${price} USD → ₹{inr_price} INR")
                print("✓ Converted currency from USD to INR")
            else:
                print("✓ No USD plans found to convert")
            
            # Update default currency for new plans
            cursor.execute('''
                UPDATE subscription_plans 
                SET currency = 'INR' 
                WHERE currency IS NULL OR currency = ''
            ''')
            
            # Update payments table currency if needed
            cursor.execute("SELECT COUNT(*) FROM payments WHERE currency = 'USD'")
            usd_payments = cursor.fetchone()[0]
            
            if usd_payments > 0:
                print(f"Converting {usd_payments} payments from USD to INR...")
                cursor.execute('''
                    UPDATE payments 
                    SET amount = amount * 83.0, currency = 'INR' 
                    WHERE currency = 'USD'
                ''')
                print("✓ Converted payment amounts from USD to INR")
            else:
                print("✓ No USD payments found to convert")
            
            conn.commit()
            print("\n✅ Database schema update completed successfully!")
            
            # Display updated plans
            cursor.execute("SELECT name, price, currency, ai_analysis_limit FROM subscription_plans")
            plans = cursor.fetchall()
            
            print("\nUpdated subscription plans:")
            print("-" * 60)
            for name, price, currency, ai_limit in plans:
                print(f"{name:15} | ₹{price:8.2f} {currency} | {ai_limit:3d} AI analyses/month")
            print("-" * 60)
            
    except Exception as e:
        print(f"❌ Error updating database schema: {str(e)}")
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
    print("🔄 Starting database schema update...")
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
    
    # Update schema
    if update_database_schema():
        print("\n🎉 Schema update completed successfully!")
        print(f"💾 Backup saved at: {backup_path}")
    else:
        print("\n❌ Schema update failed!")
        sys.exit(1)