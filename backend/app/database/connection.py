"""
Database connection and configuration.
"""

import sqlite3
import os
from contextlib import contextmanager
from typing import Generator
import logging

logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL')
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'database.db')

# Determine if we're using MySQL or SQLite
USE_MYSQL = DATABASE_URL and DATABASE_URL.startswith('mysql')

if USE_MYSQL:
    try:
        import pymysql
        import sqlalchemy
        from sqlalchemy import create_engine, text
        from sqlalchemy.pool import QueuePool
        
        # Create MySQL engine
        engine = create_engine(
            DATABASE_URL,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        logger.info(f"Using MySQL database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'configured'}")
    except ImportError as e:
        logger.error(f"MySQL dependencies not installed: {e}")
        logger.info("Falling back to SQLite")
        USE_MYSQL = False
else:
    logger.info(f"Using SQLite database: {DB_PATH}")

def init_database():
    """Initialize the database with required tables."""
    try:
        if USE_MYSQL:
            # MySQL initialization
            with engine.connect() as conn:
                from sqlalchemy import text
                
                # Create tables using MySQL syntax
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS subscription_plans (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        price DECIMAL(10,2) NOT NULL,
                        currency VARCHAR(3) DEFAULT 'INR',
                        interval_type VARCHAR(50) NOT NULL DEFAULT 'month',
                        execution_limit INT DEFAULT 100,
                        storage_limit INT DEFAULT 1024,
                        ai_analysis_limit INT DEFAULT 10,
                        features TEXT,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                '''))
                
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        first_name VARCHAR(100),
                        last_name VARCHAR(100),
                        role VARCHAR(20) DEFAULT 'student',
                        is_active BOOLEAN DEFAULT TRUE,
                        email_verified BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        last_login TIMESTAMP NULL
                    )
                '''))
                
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS user_daily_usage (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        usage_date DATE NOT NULL,
                        ai_analysis_count INT DEFAULT 0,
                        code_generation_count INT DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                        UNIQUE KEY unique_user_date (user_id, usage_date)
                    )
                '''))
                
                # Create other tables...
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS user_subscriptions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        plan_id INT NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        status VARCHAR(20) DEFAULT 'active',
                        auto_renew BOOLEAN DEFAULT FALSE,
                        custom_duration_days INT,
                        total_amount DECIMAL(10,2) NOT NULL,
                        currency VARCHAR(3) DEFAULT 'USD',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        cancelled_at TIMESTAMP NULL,
                        cancellation_reason TEXT,
                        FOREIGN KEY (plan_id) REFERENCES subscription_plans (id)
                    )
                '''))
                
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS payments (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        subscription_id INT,
                        payment_gateway VARCHAR(50) NOT NULL,
                        gateway_transaction_id VARCHAR(255),
                        gateway_payment_intent_id VARCHAR(255),
                        amount DECIMAL(10,2) NOT NULL,
                        currency VARCHAR(3) DEFAULT 'USD',
                        status VARCHAR(20) DEFAULT 'pending',
                        payment_method VARCHAR(50),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        completed_at TIMESTAMP NULL,
                        failed_reason TEXT,
                        FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id)
                    )
                '''))
                
                conn.execute(text('''
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        admin_user_id INT,
                        action VARCHAR(100) NOT NULL,
                        target_type VARCHAR(50),
                        target_id INT,
                        old_values TEXT,
                        new_values TEXT,
                        ip_address VARCHAR(45),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                '''))
                
                conn.commit()
                logger.info("MySQL database initialized successfully")
                
                # Check and insert default data
                result = conn.execute(text('SELECT COUNT(*) as count FROM subscription_plans'))
                count = result.fetchone()[0]
                if count == 0:
                    insert_default_plans_mysql(conn)
                    logger.info("Default subscription plans inserted")
                
                result = conn.execute(text("SELECT COUNT(*) as count FROM users WHERE role = 'admin'"))
                count = result.fetchone()[0]
                if count == 0:
                    insert_default_admin_mysql(conn)
                    logger.info("Default admin user created")
                
                result = conn.execute(text("SELECT COUNT(*) as count FROM users WHERE role = 'student'"))
                count = result.fetchone()[0]
                if count == 0:
                    insert_default_user_mysql(conn)
                    logger.info("Default regular user created")
        else:
            # SQLite initialization (existing code)
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
            
            # Create subscription_plans table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS subscription_plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    price REAL NOT NULL,
                    currency TEXT DEFAULT 'INR',
                    interval_type TEXT NOT NULL DEFAULT 'month',
                    execution_limit INTEGER DEFAULT 100,
                    storage_limit INTEGER DEFAULT 1024,
                    ai_analysis_limit INTEGER DEFAULT 10,
                    features TEXT, -- JSON string
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create user_subscriptions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    plan_id INTEGER NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    status TEXT DEFAULT 'active',
                    auto_renew BOOLEAN DEFAULT 0,
                    custom_duration_days INTEGER,
                    total_amount REAL NOT NULL,
                    currency TEXT DEFAULT 'USD',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    cancelled_at TIMESTAMP,
                    cancellation_reason TEXT,
                    FOREIGN KEY (plan_id) REFERENCES subscription_plans (id)
                )
            ''')
            
            # Create payments table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    subscription_id INTEGER,
                    payment_gateway TEXT NOT NULL,
                    gateway_transaction_id TEXT,
                    gateway_payment_intent_id TEXT,
                    amount REAL NOT NULL,
                    currency TEXT DEFAULT 'USD',
                    status TEXT DEFAULT 'pending',
                    payment_method TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    failed_reason TEXT,
                    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id)
                )
            ''')
            
            # Create users table (basic structure)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    first_name TEXT,
                    last_name TEXT,
                    role TEXT DEFAULT 'student',
                    is_active BOOLEAN DEFAULT 1,
                    email_verified BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            ''')
            
            # Create audit_logs table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_user_id INTEGER,
                    action TEXT NOT NULL,
                    target_type TEXT,
                    target_id INTEGER,
                    old_values TEXT, -- JSON string
                    new_values TEXT, -- JSON string
                    ip_address TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create user_daily_usage table for tracking daily usage limits
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_daily_usage (
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
            
            # Create index for user_daily_usage table
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_user_daily_usage_user_date 
                ON user_daily_usage(user_id, usage_date)
            ''')
            
            conn.commit()
            logger.info("Database initialized successfully")
            
            # Insert default plans if none exist
            cursor.execute('SELECT COUNT(*) FROM subscription_plans')
            if cursor.fetchone()[0] == 0:
                insert_default_plans(cursor)
                conn.commit()
                logger.info("Default subscription plans inserted")
            
            # Insert default admin user if none exist
            cursor.execute('SELECT COUNT(*) FROM users WHERE role = ?', ('admin',))
            if cursor.fetchone()[0] == 0:
                insert_default_admin(cursor)
                conn.commit()
                logger.info("Default admin user created")
            
            # Insert default regular user if none exist
            cursor.execute('SELECT COUNT(*) FROM users WHERE role = ?', ('student',))
            if cursor.fetchone()[0] == 0:
                insert_default_user(cursor)
                conn.commit()
                logger.info("Default regular user created")
                
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise

def insert_default_plans(cursor):
    """Insert default subscription plans."""
    default_plans = [
        {
            'name': 'Basic',
            'description': 'Basic plan with limited features',
            'price': 799.00,
            'currency': 'INR',
            'interval_type': 'month',
            'execution_limit': 100,
            'storage_limit': 1024,
            'ai_analysis_limit': 10,
            'features': '["Code execution", "Basic support", "10 AI analyses per month"]',
            'is_active': 1
        },
        {
            'name': 'Premium',
            'description': 'Premium plan with enhanced AI features',
            'price': 1599.00,
            'currency': 'INR',
            'interval_type': 'month',
            'execution_limit': 500,
            'storage_limit': 5120,
            'ai_analysis_limit': 50,
            'features': '["Code execution", "AI analysis", "Priority support", "50 AI analyses per month"]',
            'is_active': 1
        },
        {
            'name': 'Annual',
            'description': 'Annual plan with maximum benefits',
            'price': 15999.00,
            'currency': 'INR',
            'interval_type': 'year',
            'execution_limit': 6000,
            'storage_limit': 10240,
            'ai_analysis_limit': 600,
            'features': '["Code execution", "AI analysis", "Priority support", "Advanced features", "600 AI analyses per year"]',
            'is_active': 1
        }
    ]
    
    for plan in default_plans:
        cursor.execute('''
            INSERT INTO subscription_plans 
            (name, description, price, currency, interval_type, execution_limit, storage_limit, ai_analysis_limit, features, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            plan['name'], plan['description'], plan['price'], plan['currency'],
            plan['interval_type'], plan['execution_limit'], plan['storage_limit'],
            plan['ai_analysis_limit'], plan['features'], plan['is_active']
        ))

def insert_default_admin(cursor):
    """Insert default admin user for demo purposes."""
    import bcrypt
    from datetime import datetime
    
    # Default admin credentials for demo
    admin_email = "admin@demo.com"
    admin_password = "admin123"
    admin_first_name = "Demo"
    admin_last_name = "Admin"
    
    # Hash the password
    password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Insert admin user
    cursor.execute('''
        INSERT INTO users 
        (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        admin_email,
        password_hash,
        admin_first_name,
        admin_last_name,
        'admin',
        1,  # is_active
        1,  # email_verified
        datetime.utcnow().isoformat(),
        datetime.utcnow().isoformat()
    ))

def insert_default_user(cursor):
    """Insert default regular user for demo purposes."""
    import bcrypt
    from datetime import datetime
    
    # Default user credentials for demo
    user_email = "user@demo.com"
    user_password = "user123"
    user_first_name = "Demo"
    user_last_name = "User"
    
    # Hash the password
    password_hash = bcrypt.hashpw(user_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Insert regular user
    cursor.execute('''
        INSERT INTO users 
        (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_email,
        password_hash,
        user_first_name,
        user_last_name,
        'student',
        1,  # is_active
        1,  # email_verified
        datetime.utcnow().isoformat(),
        datetime.utcnow().isoformat()
    ))

@contextmanager
def get_db_connection():
    """Get database connection with context manager."""
    if USE_MYSQL:
        # MySQL connection
        conn = None
        try:
            conn = engine.connect()
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {str(e)}")
            raise
        finally:
            if conn:
                conn.close()
    else:
        # SQLite connection
        conn = None
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row  # Enable dict-like access to rows
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {str(e)}")
            raise
        finally:
            if conn:
                conn.close()

def execute_query(query: str, params: tuple = None, fetch_one: bool = False, fetch_all: bool = False):
    """Execute a database query."""
    with get_db_connection() as conn:
        if USE_MYSQL:
            from sqlalchemy import text
            if params:
                result = conn.execute(text(query), params)
            else:
                result = conn.execute(text(query))
            
            if fetch_one:
                return result.fetchone()
            elif fetch_all:
                return result.fetchall()
            else:
                conn.commit()
                return result.lastrowid
        else:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if fetch_one:
                return cursor.fetchone()
            elif fetch_all:
                return cursor.fetchall()
            else:
                conn.commit()
                return cursor.lastrowid

def insert_default_plans_mysql(conn):
    """Insert default subscription plans for MySQL."""
    from sqlalchemy import text
    
    default_plans = [
        {
            'name': 'Basic',
            'description': 'Basic plan with limited features',
            'price': 799.00,
            'currency': 'INR',
            'interval_type': 'month',
            'execution_limit': 100,
            'storage_limit': 1024,
            'ai_analysis_limit': 10,
            'features': '["Code execution", "Basic support", "10 AI analyses per month"]',
            'is_active': 1
        },
        {
            'name': 'Premium',
            'description': 'Premium plan with enhanced AI features',
            'price': 1599.00,
            'currency': 'INR',
            'interval_type': 'month',
            'execution_limit': 500,
            'storage_limit': 5120,
            'ai_analysis_limit': 50,
            'features': '["Code execution", "AI analysis", "Priority support", "50 AI analyses per month"]',
            'is_active': 1
        },
        {
            'name': 'Annual',
            'description': 'Annual plan with maximum benefits',
            'price': 15999.00,
            'currency': 'INR',
            'interval_type': 'year',
            'execution_limit': 6000,
            'storage_limit': 10240,
            'ai_analysis_limit': 600,
            'features': '["Code execution", "AI analysis", "Priority support", "Advanced features", "600 AI analyses per year"]',
            'is_active': 1
        }
    ]
    
    for plan in default_plans:
        conn.execute(text('''
            INSERT INTO subscription_plans 
            (name, description, price, currency, interval_type, execution_limit, storage_limit, ai_analysis_limit, features, is_active)
            VALUES (:name, :description, :price, :currency, :interval_type, :execution_limit, :storage_limit, :ai_analysis_limit, :features, :is_active)
        '''), plan)
    
    conn.commit()

def insert_default_admin_mysql(conn):
    """Insert default admin user for MySQL."""
    import bcrypt
    from datetime import datetime
    from sqlalchemy import text
    
    admin_email = "admin@demo.com"
    admin_password = "admin123"
    admin_first_name = "Demo"
    admin_last_name = "Admin"
    
    password_hash = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    conn.execute(text('''
        INSERT INTO users 
        (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
        VALUES (:email, :password_hash, :first_name, :last_name, :role, :is_active, :email_verified, :created_at, :updated_at)
    '''), {
        'email': admin_email,
        'password_hash': password_hash,
        'first_name': admin_first_name,
        'last_name': admin_last_name,
        'role': 'admin',
        'is_active': 1,
        'email_verified': 1,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    })
    
    conn.commit()

def insert_default_user_mysql(conn):
    """Insert default regular user for MySQL."""
    import bcrypt
    from datetime import datetime
    from sqlalchemy import text
    
    user_email = "user@demo.com"
    user_password = "user123"
    user_first_name = "Demo"
    user_last_name = "User"
    
    password_hash = bcrypt.hashpw(user_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    conn.execute(text('''
        INSERT INTO users 
        (email, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
        VALUES (:email, :password_hash, :first_name, :last_name, :role, :is_active, :email_verified, :created_at, :updated_at)
    '''), {
        'email': user_email,
        'password_hash': password_hash,
        'first_name': user_first_name,
        'last_name': user_last_name,
        'role': 'student',
        'is_active': 1,
        'email_verified': 1,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    })
    
    conn.commit()