#!/usr/bin/env python3
"""
User Authentication Module for Traffic Violation Detection System
Handles user login, password verification, and role management
"""
# 🔥 Working - OK 🔥
import hashlib
import sqlite3
import os
from typing import Optional, Dict, List

class UserAuth:
    def __init__(self, db_path: str = "traffic_system.db"):
        self.db_path = db_path
        self.init_database()
        self.create_default_users()
    
    def init_database(self):
        """Initialize the users database table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def hash_password(self, password: str) -> str:
        """Hash password using SHA-256"""
        return hashlib.sha256(password.encode('utf-8')).hexdigest()
    
    def create_default_users(self):
        """Create default users if they don't exist"""
        default_users = [
            ("admin", "admin123", "Administrator"),
            ("officer1", "officer123", "Traffic Officer"),
            ("public", "public123", "Public"),
            ("test", "test", "Traffic Officer")  # Simple test user
        ]
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        for username, password, role in default_users:
            try:
                password_hash = self.hash_password(password)
                cursor.execute('''
                    INSERT OR IGNORE INTO users (username, password_hash, role)
                    VALUES (?, ?, ?)
                ''', (username, password_hash, role))
            except sqlite3.IntegrityError:
                pass  # User already exists
        
        conn.commit()
        conn.close()
    
    def authenticate(self, username: str, password: str, role: str) -> bool:
        """
        Authenticate user credentials and role
        
        Args:
            username: Username to authenticate
            password: Password to verify
            role: Required role for access
            
        Returns:
            bool: True if authentication successful, False otherwise
        """
        try:
            # Debug prints
            print(f"Attempting authentication for: {username}, role: {role}")
            
            # Strip whitespace and convert to lowercase for username
            username = username.strip().lower()
            password = password.strip()
            role = role.strip()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get user from database
            cursor.execute('''
                SELECT username, password_hash, role, is_active
                FROM users 
                WHERE LOWER(username) = ? AND is_active = 1
            ''', (username,))
            
            user = cursor.fetchone()
            
            if not user:
                print(f"User '{username}' not found in database")
                conn.close()
                return False
            
            stored_username, stored_password_hash, stored_role, is_active = user
            print(f"Found user: {stored_username}, stored role: {stored_role}")
            
            # Verify password
            password_hash = self.hash_password(password)
            if password_hash != stored_password_hash:
                print("Password mismatch")
                conn.close()
                return False
            
            # Verify role
            if stored_role != role:
                print(f"Role mismatch: expected {role}, got {stored_role}")
                conn.close()
                return False
            
            # Update last login time
            cursor.execute('''
                UPDATE users 
                SET last_login = CURRENT_TIMESTAMP 
                WHERE LOWER(username) = ?
            ''', (username,))
            
            conn.commit()
            conn.close()
            
            print("Authentication successful!")
            return True
            
        except Exception as e:
            print(f"Authentication error: {e}")
            return False
    
    def add_user(self, username: str, password: str, role: str) -> bool:
        """
        Add a new user to the system
        
        Args:
            username: New username
            password: User password
            role: User role (Administrator, Traffic Officer, Public)
            
        Returns:
            bool: True if user added successfully, False otherwise
        """
        try:
            if role not in ["Administrator", "Traffic Officer", "Public"]:
                return False
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            password_hash = self.hash_password(password)
            
            cursor.execute('''
                INSERT INTO users (username, password_hash, role)
                VALUES (?, ?, ?)
            ''', (username.strip().lower(), password_hash, role))
            
            conn.commit()
            conn.close()
            
            return True
            
        except sqlite3.IntegrityError:
            return False  # Username already exists
        except Exception as e:
            print(f"Error adding user: {e}")
            return False
    
    def change_password(self, username: str, old_password: str, new_password: str) -> bool:
        """
        Change user password
        
        Args:
            username: Username
            old_password: Current password
            new_password: New password
            
        Returns:
            bool: True if password changed successfully, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Verify current password
            old_password_hash = self.hash_password(old_password)
            cursor.execute('''
                SELECT id FROM users 
                WHERE LOWER(username) = ? AND password_hash = ? AND is_active = 1
            ''', (username.strip().lower(), old_password_hash))
            
            if not cursor.fetchone():
                conn.close()
                return False
            
            # Update password
            new_password_hash = self.hash_password(new_password)
            cursor.execute('''
                UPDATE users 
                SET password_hash = ? 
                WHERE LOWER(username) = ?
            ''', (new_password_hash, username.strip().lower()))
            
            conn.commit()
            conn.close()
            
            return True
            
        except Exception as e:
            print(f"Error changing password: {e}")
            return False
    
    def get_all_users(self) -> List[Dict]:
        """
        Get all users (for admin interface)
        
        Returns:
            List of user dictionaries
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT username, role, created_at, last_login, is_active
                FROM users
                ORDER BY username
            ''')
            
            users = []
            for row in cursor.fetchall():
                users.append({
                    'username': row[0],
                    'role': row[1],
                    'created_at': row[2],
                    'last_login': row[3],
                    'is_active': bool(row[4])
                })
            
            conn.close()
            return users
            
        except Exception as e:
            print(f"Error getting users: {e}")
            return []
    
    def deactivate_user(self, username: str) -> bool:
        """
        Deactivate a user account
        
        Args:
            username: Username to deactivate
            
        Returns:
            bool: True if deactivated successfully, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE users 
                SET is_active = 0 
                WHERE LOWER(username) = ?
            ''', (username.strip().lower(),))
            
            conn.commit()
            conn.close()
            
            return cursor.rowcount > 0
            
        except Exception as e:
            print(f"Error deactivating user: {e}")
            return False
    
    def activate_user(self, username: str) -> bool:
        """
        Activate a user account
        
        Args:
            username: Username to activate
            
        Returns:
            bool: True if activated successfully, False otherwise
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE users 
                SET is_active = 1 
                WHERE LOWER(username) = ?
            ''', (username.strip().lower(),))
            
            conn.commit()
            conn.close()
            
            return cursor.rowcount > 0
            
        except Exception as e:
            print(f"Error activating user: {e}")
            return False

# Test the authentication system
if __name__ == "__main__":
    # Test authentication
    auth = UserAuth()
    
    print("Testing authentication system...")
    print("Default users created:")
    print("- admin/admin123 (Administrator)")
    print("- officer1/officer123 (Traffic Officer)")
    print("- public/public123 (Public)")
    print("- test/test (Traffic Officer)")
    
    # Test authentication
    test_cases = [
        ("admin", "admin123", "Administrator"),
        ("officer1", "officer123", "Traffic Officer"),
        ("public", "public123", "Public"),
        ("test", "test", "Traffic Officer"),
        ("admin", "wrong", "Administrator"),  # Wrong password
        ("nonexistent", "password", "Public"),  # Non-existent user
        ("admin", "admin123", "Traffic Officer")  # Wrong role
    ]
    
    for username, password, role in test_cases:
        result = auth.authenticate(username, password, role)
        print(f"Auth test: {username}/{password}/{role} -> {'SUCCESS' if result else 'FAILED'}")