#!/usr/bin/env python3
"""
Debug the database path resolution.
"""

import os
import sys

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import DB_PATH

def debug_path():
    """Debug the database path."""
    print(f"Current working directory: {os.getcwd()}")
    print(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")
    print(f"DB_PATH from connection.py: {DB_PATH}")
    print(f"DB_PATH resolved: {os.path.abspath(DB_PATH)}")
    print(f"DB_PATH exists: {os.path.exists(DB_PATH)}")
    
    # Check what's in the directory
    db_dir = os.path.dirname(DB_PATH)
    print(f"\nContents of {db_dir}:")
    if os.path.exists(db_dir):
        for item in os.listdir(db_dir):
            if item.endswith('.db'):
                full_path = os.path.join(db_dir, item)
                print(f"  {item} - {os.path.getsize(full_path)} bytes")
    else:
        print("  Directory does not exist!")

if __name__ == "__main__":
    debug_path()