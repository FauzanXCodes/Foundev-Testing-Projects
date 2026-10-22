#!/usr/bin/env python3
"""
Database Manager Module
Handles all database operations for the Traffic Violation Detection System
"""

import sqlite3
import json
import csv
import datetime
from typing import List, Dict, Any, Optional
import os

class DatabaseManager:
    def __init__(self, db_path: str = "traffic_violations.db"):
        """
        Initialize database manager
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create violations table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS violations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        violation_id TEXT UNIQUE NOT NULL,
                        type TEXT NOT NULL,
                        camera_id INTEGER NOT NULL,
                        timestamp DATETIME NOT NULL,
                        confidence REAL,
                        officer TEXT,
                        details TEXT,
                        image_path TEXT,
                        processed BOOLEAN DEFAULT FALSE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create users table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL,
                        full_name TEXT,
                        email TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_login DATETIME,
                        active BOOLEAN DEFAULT TRUE
                    )
                ''')
                
                # Create system_logs table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS system_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        level TEXT NOT NULL,
                        message TEXT NOT NULL,
                        module TEXT,
                        user_id INTEGER,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                ''')
                
                # Create cameras table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cameras (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        location TEXT,
                        status TEXT DEFAULT 'active',
                        last_maintenance DATETIME,
                        settings TEXT
                    )
                ''')
                
                # Create violation_images table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS violation_images (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        violation_id TEXT NOT NULL,
                        image_path TEXT NOT NULL,
                        image_type TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (violation_id) REFERENCES violations (violation_id)
                    )
                ''')
                
                # Create indexes for better performance
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(type)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_violations_camera ON violations(camera_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_violations_officer ON violations(officer)')
                
                # Insert default cameras if not exist
                self.setup_default_cameras()
                
                conn.commit()
                print("Database initialized successfully")
                
        except sqlite3.Error as e:
            print(f"Database initialization error: {e}")
    
    def setup_default_cameras(self):
        """Setup default camera configurations"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                default_cameras = [
                    (1, "Main Entrance Camera", "North Gate", "active"),
                    (2, "Roundabout Camera", "Central Roundabout", "active"),
                    (3, "Highway Camera", "Highway Junction", "active"),
                    (4, "Parking Area Camera", "Parking Entrance", "active")
                ]
                
                for camera_id, name, location, status in default_cameras:
                    cursor.execute('''
                        INSERT OR IGNORE INTO cameras (id, name, location, status)
                        VALUES (?, ?, ?, ?)
                    ''', (camera_id, name, location, status))
                
                conn.commit()
                
        except sqlite3.Error as e:
            print(f"Error setting up default cameras: {e}")
    
    def save_violation(self, violation_data: Dict[str, Any]) -> bool:
        
        """
        Save a violation to the database (datetime and objects are made serializable)
        """
        import datetime, json

        try:
            # --- Make values safe before inserting ---
            safe_data = {}
            for key, value in violation_data.items():
                if isinstance(value, datetime.datetime):
                    safe_data[key] = value.isoformat()  # convert datetime → str
                elif hasattr(value, "__dict__"):  
                    safe_data[key] = dict(value.__dict__)  # dataclass/objects → dict
                else:
                    safe_data[key] = value

            # Ensure details dict is JSON-serializable
            details = safe_data.get("details", {})
            details_json = json.dumps(details, default=str)

            # Generate violation ID if not provided
            if "violation_id" not in safe_data:
                safe_data["violation_id"] = self.generate_violation_id(safe_data["type"])

            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO violations 
                    (violation_id, type, camera_id, timestamp, confidence, officer, details)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        safe_data["violation_id"],
                        safe_data["type"],
                        safe_data["camera_id"],
                        safe_data["timestamp"],   # now a string
                        safe_data.get("confidence", 0.0),
                        safe_data.get("officer"),
                        details_json
                    )
                )
                conn.commit()

            # Log event
            self.log_system_event(
                "INFO",
                f"Violation saved: {safe_data['violation_id']} - {safe_data['type']}",
                "database_manager"
            )
            return True
    
        except sqlite3.Error as e:
            print(f"Error saving violation: {e}")
            self.log_system_event("ERROR", f"Failed to save violation: {e}", "database_manager")
            return False

    
    def generate_violation_id(self, violation_type: str) -> str:
        """
        Generate a unique violation ID
        
        Args:
            violation_type: Type of violation
            
        Returns:
            Unique violation ID string
        """
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        type_prefix = violation_type.upper()[:3]
        
        # Get count of violations today for this type
        today = datetime.date.today()
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) FROM violations 
                WHERE type = ? AND DATE(timestamp) = ?
            ''', (violation_type, today))
            count = cursor.fetchone()[0]
        
        return f"{type_prefix}_{timestamp}_{count+1:04d}"
    
    def get_all_violations(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get all violations from database
        
        Args:
            limit: Maximum number of records to return
            
        Returns:
            List of violation dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                query = '''
                    SELECT v.*, c.name as camera_name, c.location as camera_location
                    FROM violations v
                    LEFT JOIN cameras c ON v.camera_id = c.id
                    ORDER BY v.timestamp DESC
                '''
                
                if limit:
                    query += f" LIMIT {limit}"
                
                cursor.execute(query)
                
                columns = [description[0] for description in cursor.description]
                violations = []
                
                for row in cursor.fetchall():
                    violation = dict(zip(columns, row))
                    # Parse JSON details
                    if violation['details']:
                        try:
                            violation['details'] = json.loads(violation['details'])
                        except json.JSONDecodeError:
                            violation['details'] = violation['details']
                    violations.append(violation)
                
                return violations
                
        except sqlite3.Error as e:
            print(f"Error retrieving violations: {e}")
            return []
    
    def get_violations_by_date(self, date: datetime.date) -> List[Dict[str, Any]]:
        """
        Get violations for a specific date
        
        Args:
            date: Date to filter violations
            
        Returns:
            List of violation dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT v.*, c.name as camera_name, c.location as camera_location
                    FROM violations v
                    LEFT JOIN cameras c ON v.camera_id = c.id
                    WHERE DATE(v.timestamp) = ?
                    ORDER BY v.timestamp DESC
                ''', (date,))
                
                columns = [description[0] for description in cursor.description]
                violations = []
                
                for row in cursor.fetchall():
                    violation = dict(zip(columns, row))
                    if violation['details']:
                        try:
                            violation['details'] = json.loads(violation['details'])
                        except json.JSONDecodeError:
                            violation['details'] = violation['details']
                    violations.append(violation)
                
                return violations
                
        except sqlite3.Error as e:
            print(f"Error retrieving violations by date: {e}")
            return []
    
    def get_violations_by_type(self, violation_type: str) -> List[Dict[str, Any]]:
        """
        Get violations by type
        
        Args:
            violation_type: Type of violation to filter
            
        Returns:
            List of violation dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT v.*, c.name as camera_name, c.location as camera_location
                    FROM violations v
                    LEFT JOIN cameras c ON v.camera_id = c.id
                    WHERE v.type = ?
                    ORDER BY v.timestamp DESC
                ''', (violation_type,))
                
                columns = [description[0] for description in cursor.description]
                violations = []
                
                for row in cursor.fetchall():
                    violation = dict(zip(columns, row))
                    if violation['details']:
                        try:
                            violation['details'] = json.loads(violation['details'])
                        except json.JSONDecodeError:
                            violation['details'] = violation['details']
                    violations.append(violation)
                
                return violations
                
        except sqlite3.Error as e:
            print(f"Error retrieving violations by type: {e}")
            return []
    
    def get_violations_by_camera(self, camera_id: int) -> List[Dict[str, Any]]:
        """
        Get violations for a specific camera
        
        Args:
            camera_id: Camera ID to filter violations
            
        Returns:
            List of violation dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT v.*, c.name as camera_name, c.location as camera_location
                    FROM violations v
                    LEFT JOIN cameras c ON v.camera_id = c.id
                    WHERE v.camera_id = ?
                    ORDER BY v.timestamp DESC
                ''', (camera_id,))
                
                columns = [description[0] for description in cursor.description]
                violations = []
                
                for row in cursor.fetchall():
                    violation = dict(zip(columns, row))
                    if violation['details']:
                        try:
                            violation['details'] = json.loads(violation['details'])
                        except json.JSONDecodeError:
                            violation['details'] = violation['details']
                    violations.append(violation)
                
                return violations
                
        except sqlite3.Error as e:
            print(f"Error retrieving violations by camera: {e}")
            return []
    
    def get_violation_statistics(self) -> Dict[str, Any]:
        """
        Get violation statistics
        
        Returns:
            Dictionary with various statistics
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                stats = {}
                
                # Total violations
                cursor.execute("SELECT COUNT(*) FROM violations")
                stats['total_violations'] = cursor.fetchone()[0]
                
                # Violations by type
                cursor.execute('''
                    SELECT type, COUNT(*) 
                    FROM violations 
                    GROUP BY type
                ''')
                stats['by_type'] = dict(cursor.fetchall())
                
                # Violations by camera
                cursor.execute('''
                    SELECT c.name, COUNT(v.id) 
                    FROM cameras c
                    LEFT JOIN violations v ON c.id = v.camera_id
                    GROUP BY c.id, c.name
                ''')
                stats['by_camera'] = dict(cursor.fetchall())
                
                # Violations by officer
                cursor.execute('''
                    SELECT COALESCE(officer, 'System'), COUNT(*) 
                    FROM violations 
                    GROUP BY officer
                ''')
                stats['by_officer'] = dict(cursor.fetchall())
                
                # Daily violations (last 7 days)
                cursor.execute('''
                    SELECT DATE(timestamp) as date, COUNT(*) 
                    FROM violations 
                    WHERE timestamp >= datetime('now', '-7 days')
                    GROUP BY DATE(timestamp)
                    ORDER BY date
                ''')
                stats['daily_last_7_days'] = dict(cursor.fetchall())
                
                # Hourly distribution
                cursor.execute('''
                    SELECT strftime('%H', timestamp) as hour, COUNT(*) 
                    FROM violations 
                    GROUP BY hour
                    ORDER BY hour
                ''')
                stats['hourly_distribution'] = dict(cursor.fetchall())
                
                return stats
                
        except sqlite3.Error as e:
            print(f"Error retrieving statistics: {e}")
            return {}
    
    def update_violation_status(self, violation_id: str, processed: bool) -> bool:
        """
        Update violation processing status
        
        Args:
            violation_id: ID of the violation
            processed: Processing status
            
        Returns:
            Boolean indicating success
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE violations 
                    SET processed = ? 
                    WHERE violation_id = ?
                ''', (processed, violation_id))
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    self.log_system_event(
                        "INFO", 
                        f"Violation {violation_id} status updated to {'processed' if processed else 'unprocessed'}",
                        "database_manager"
                    )
                    return True
                else:
                    return False
                    
        except sqlite3.Error as e:
            print(f"Error updating violation status: {e}")
            return False
    
    def delete_violation(self, violation_id: str) -> bool:
        """
        Delete a violation record
        
        Args:
            violation_id: ID of the violation to delete
            
        Returns:
            Boolean indicating success
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Delete associated images first
                cursor.execute('''
                    DELETE FROM violation_images 
                    WHERE violation_id = ?
                ''', (violation_id,))
                
                # Delete the violation
                cursor.execute('''
                    DELETE FROM violations 
                    WHERE violation_id = ?
                ''', (violation_id,))
                
                conn.commit()
                
                if cursor.rowcount > 0:
                    self.log_system_event(
                        "INFO", 
                        f"Violation {violation_id} deleted",
                        "database_manager"
                    )
                    return True
                else:
                    return False
                    
        except sqlite3.Error as e:
            print(f"Error deleting violation: {e}")
            return False
    
    def save_violation_image(self, violation_id: str, image_path: str, image_type: str = "evidence") -> bool:
        """
        Save violation image path to database
        
        Args:
            violation_id: ID of the violation
            image_path: Path to the image file
            image_type: Type of image (evidence, processed, etc.)
            
        Returns:
            Boolean indicating success
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO violation_images (violation_id, image_path, image_type)
                    VALUES (?, ?, ?)
                ''', (violation_id, image_path, image_type))
                
                conn.commit()
                return True
                
        except sqlite3.Error as e:
            print(f"Error saving violation image: {e}")
            return False
    
    def get_camera_info(self, camera_id: int) -> Optional[Dict[str, Any]]:
        """
        Get camera information
        
        Args:
            camera_id: ID of the camera
            
        Returns:
            Camera information dictionary or None
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM cameras WHERE id = ?
                ''', (camera_id,))
                
                row = cursor.fetchone()
                if row:
                    columns = [description[0] for description in cursor.description]
                    camera_info = dict(zip(columns, row))
                    
                    # Parse settings JSON if exists
                    if camera_info['settings']:
                        try:
                            camera_info['settings'] = json.loads(camera_info['settings'])
                        except json.JSONDecodeError:
                            camera_info['settings'] = {}
                    
                    return camera_info
                
                return None
                
        except sqlite3.Error as e:
            print(f"Error retrieving camera info: {e}")
            return None
    
    def update_camera_settings(self, camera_id: int, settings: Dict[str, Any]) -> bool:
        """
        Update camera settings
        
        Args:
            camera_id: ID of the camera
            settings: Settings dictionary
            
        Returns:
            Boolean indicating success
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE cameras 
                    SET settings = ? 
                    WHERE id = ?
                ''', (json.dumps(settings), camera_id))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except sqlite3.Error as e:
            print(f"Error updating camera settings: {e}")
            return False
    
    def log_system_event(self, level: str, message: str, module: str, user_id: Optional[int] = None):
        """
        Log system events
        
        Args:
            level: Log level (INFO, WARNING, ERROR)
            message: Log message
            module: Module name
            user_id: User ID (optional)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO system_logs (level, message, module, user_id)
                    VALUES (?, ?, ?, ?)
                ''', (level, message, module, user_id))
                
                conn.commit()
                
        except sqlite3.Error as e:
            print(f"Error logging system event: {e}")
    
    def get_system_logs(self, limit: int = 100, level: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get system logs
        
        Args:
            limit: Maximum number of logs to return
            level: Filter by log level (optional)
            
        Returns:
            List of log dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                query = '''
                    SELECT sl.*, u.username 
                    FROM system_logs sl
                    LEFT JOIN users u ON sl.user_id = u.id
                '''
                
                params = []
                if level:
                    query += " WHERE sl.level = ?"
                    params.append(level)
                
                query += " ORDER BY sl.timestamp DESC LIMIT ?"
                params.append(limit)
                
                cursor.execute(query, params)
                
                columns = [description[0] for description in cursor.description]
                logs = []
                
                for row in cursor.fetchall():
                    log = dict(zip(columns, row))
                    logs.append(log)
                
                return logs
                
        except sqlite3.Error as e:
            print(f"Error retrieving system logs: {e}")
            return []
    
    def export_data(self, filename: str, data_type: str = "violations") -> bool:
        """
        Export data to file
        
        Args:
            filename: Output filename
            data_type: Type of data to export
            
        Returns:
            Boolean indicating success
        """
        try:
            if data_type == "violations":
                violations = self.get_all_violations()
                
                if filename.endswith('.json'):
                    with open(filename, 'w') as f:
                        json.dump(violations, f, indent=2, default=str)
                
                elif filename.endswith('.csv'):
                    if violations:
                        with open(filename, 'w', newline='') as f:
                            writer = csv.DictWriter(f, fieldnames=violations[0].keys())
                            writer.writeheader()
                            writer.writerows(violations)
                
                return True
            
            elif data_type == "statistics":
                stats = self.get_violation_statistics()
                
                with open(filename, 'w') as f:
                    json.dump(stats, f, indent=2, default=str)
                
                return True
            
            return False
            
        except Exception as e:
            print(f"Error exporting data: {e}")
            return False
    
    def backup_database(self, backup_path: str) -> bool:
        """
        Create database backup
        
        Args:
            backup_path: Path for backup file
            
        Returns:
            Boolean indicating success
        """
        try:
            import shutil
            shutil.copy2(self.db_path, backup_path)
            
            self.log_system_event(
                "INFO", 
                f"Database backed up to {backup_path}",
                "database_manager"
            )
            
            return True
            
        except Exception as e:
            print(f"Error creating database backup: {e}")
            return False
    
    def cleanup_old_data(self, days_to_keep: int = 30) -> bool:
        """
        Clean up old data
        
        Args:
            days_to_keep: Number of days of data to keep
            
        Returns:
            Boolean indicating success
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days_to_keep)
                
                # Delete old violations
                cursor.execute('''
                    DELETE FROM violations 
                    WHERE timestamp < ? AND processed = TRUE
                ''', (cutoff_date,))
                
                violations_deleted = cursor.rowcount
                
                # Delete old logs
                cursor.execute('''
                    DELETE FROM system_logs 
                    WHERE timestamp < ?
                ''', (cutoff_date,))
                
                logs_deleted = cursor.rowcount
                
                conn.commit()
                
                self.log_system_event(
                    "INFO", 
                    f"Cleanup completed: {violations_deleted} violations, {logs_deleted} logs deleted",
                    "database_manager"
                )
                
                return True
                
        except sqlite3.Error as e:
            print(f"Error cleaning up old data: {e}")
            return False

if __name__ == "__main__":
    # Test the database manager
    db = DatabaseManager("test_violations.db")
    
    # Test saving a violation
    test_violation = {
        'type': 'helmet',
        'camera_id': 1,
        'timestamp': datetime.datetime.now(),
        'confidence': 0.85,
        'officer': 'test_officer',
        'details': {'location': 'main road', 'vehicle_type': 'motorcycle'}
    }
    
    success = db.save_violation(test_violation)
    print(f"Violation saved: {success}")
    
    # Test retrieving violations
    violations = db.get_all_violations(limit=5)
    print(f"Retrieved {len(violations)} violations")
    
    # Test statistics
    stats = db.get_violation_statistics()
    print(f"Statistics: {stats}")