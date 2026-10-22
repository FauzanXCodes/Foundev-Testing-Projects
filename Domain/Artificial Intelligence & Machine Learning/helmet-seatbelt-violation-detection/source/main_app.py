#!/usr/bin/env python3
"""
Traffic Violation Detection System - Main Application
Supports: Helmet, Seatbelt, and Roundabout Violation Detection
Features: 4-Camera System with Multi-User Interface Support
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import cv2
import threading
import datetime
import os
from PIL import Image, ImageTk
import sqlite3
from helmet_detection_yolo8_max_accuracy import create_helmet_detector

# ------------------------------------------------------
# 3T: following are the modules that need to be created

#from seatbelt_detection_v2 import SeatbeltDetector
#from roundabout_detection_v2 import RoundaboutDetector
# ------------------------------------------------------
from database_manager import DatabaseManager
from user_authentication_v1 import UserAuth

class TrafficViolationSystem:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Traffic Violation Detection System")
        self.root.geometry("1400x900")
        self.root.configure(bg='#2c3e50')
        
        # Initialize components
        self.db_manager = DatabaseManager()
        self.user_auth = UserAuth()
        #self.helmet_detector = YOLOHelmetDetector()
        self.helmet_detector = create_helmet_detector(confidence_threshold=0.6)
        #self.seatbelt_detector = SeatbeltDetector()
        #self.roundabout_detector = RoundaboutDetector()
        
        # System variables
        self.cameras = [None] * 4  # 4 camera feeds
        self.camera_active = [False] * 4
        self.current_user = None
        self.user_role = None
        self.detection_active = {"helmet": False, "seatbelt": False, "roundabout": False}
        
        # GUI variables
        self.camera_frames = []
        self.status_labels = []
        self.violation_count = {"helmet": 0, "seatbelt": 0, "roundabout": 0}
        
        self.setup_login_interface()
    
    def setup_login_interface(self):
        """Setup login interface"""
        # Clear main window
        for widget in self.root.winfo_children():
            widget.destroy()
        
        # Login frame
        login_frame = tk.Frame(self.root, bg='#34495e', padx=50, pady=50)
        login_frame.place(relx=0.5, rely=0.5, anchor='center')
        
        tk.Label(login_frame, text="Traffic Violation Detection System", 
                font=('Arial', 18, 'bold'), bg='#34495e', fg='white').pack(pady=20)
        
        tk.Label(login_frame, text="Username:", font=('Arial', 12), 
                bg='#34495e', fg='white').pack(pady=5)
        self.username_entry = tk.Entry(login_frame, font=('Arial', 12), width=25)
        self.username_entry.pack(pady=5)
        
        tk.Label(login_frame, text="Password:", font=('Arial', 12), 
                bg='#34495e', fg='white').pack(pady=5)
        self.password_entry = tk.Entry(login_frame, font=('Arial', 12), width=25, show='*')
        self.password_entry.pack(pady=5)
        
        tk.Label(login_frame, text="Role:", font=('Arial', 12), 
                bg='#34495e', fg='white').pack(pady=5)
        self.role_var = tk.StringVar(value="Traffic Officer")
        role_combo = ttk.Combobox(login_frame, textvariable=self.role_var, 
                                 values=["Traffic Officer", "Administrator", "Public"])
        role_combo.pack(pady=5)
        
        tk.Button(login_frame, text="Login", command=self.login, 
                 bg='#3498db', fg='white', font=('Arial', 12), padx=20).pack(pady=20)
    
    def login(self):
        """Handle user login"""
        username = self.username_entry.get()
        password = self.password_entry.get()
        role = self.role_var.get()
        
        if self.user_auth.authenticate(username, password, role):
            self.current_user = username
            self.user_role = role
            self.setup_main_interface()
        else:
            messagebox.showerror("Login Failed", "Invalid credentials or role!")
    
    def setup_main_interface(self):
        """Setup main interface based on user role"""
        # Clear login interface
        for widget in self.root.winfo_children():
            widget.destroy()
        
        # Main container
        main_frame = tk.Frame(self.root, bg='#2c3e50')
        main_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Header
        self.setup_header(main_frame)
        
        # Camera feeds section
        self.setup_camera_section(main_frame)
        
        # Control panel based on user role
        if self.user_role == "Administrator":
            self.setup_admin_controls(main_frame)
        elif self.user_role == "Traffic Officer":
            self.setup_officer_controls(main_frame)
        else:  # Public
            self.setup_public_controls(main_frame)
        
        # Status and violations panel
        self.setup_status_panel(main_frame)
    
    def setup_header(self, parent):
        """Setup header section"""
        header_frame = tk.Frame(parent, bg='#34495e', height=60)
        header_frame.pack(fill='x', pady=(0, 10))
        header_frame.pack_propagate(False)
        
        tk.Label(header_frame, text=f"Traffic Violation Detection System - {self.user_role}", 
                font=('Arial', 16, 'bold'), bg='#34495e', fg='white').pack(side='left', padx=20, pady=15)
        
        tk.Label(header_frame, text=f"User: {self.current_user}", 
                font=('Arial', 12), bg='#34495e', fg='#ecf0f1').pack(side='right', padx=20, pady=15)
        
        tk.Button(header_frame, text="Logout", command=self.logout, 
                 bg='#e74c3c', fg='white', font=('Arial', 10)).pack(side='right', padx=10, pady=15)
    
    def setup_camera_section(self, parent):
        """Setup camera feeds section"""
        camera_frame = tk.LabelFrame(parent, text="Camera Feeds", font=('Arial', 12, 'bold'), 
                                   bg='#34495e', fg='white')
        camera_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Create 2x2 grid for 4 cameras
        for i in range(2):
            for j in range(2):
                cam_idx = i * 2 + j
                frame = tk.Frame(camera_frame, bg='black', relief='sunken', bd=2)
                frame.grid(row=i, column=j, padx=5, pady=5, sticky='nsew')
                
                # Camera label
                label = tk.Label(frame, text=f"Camera {cam_idx + 1}\nNo Signal", 
                               bg='black', fg='white', font=('Arial', 12))
                label.pack(expand=True)
                self.camera_frames.append(label)
                
                # Camera controls (only for Admin and Officer)
                if self.user_role in ["Administrator", "Traffic Officer"]:
                    control_frame = tk.Frame(frame, bg='#34495e')
                    control_frame.pack(side='bottom', fill='x')
                    
                    tk.Button(control_frame, text=f"Start Cam {cam_idx + 1}", 
                             command=lambda idx=cam_idx: self.start_camera(idx),
                             bg='#27ae60', fg='white', font=('Arial', 8)).pack(side='left', padx=2)
                    
                    tk.Button(control_frame, text="Stop", 
                             command=lambda idx=cam_idx: self.stop_camera(idx),
                             bg='#e74c3c', fg='white', font=('Arial', 8)).pack(side='left', padx=2)
        
        # Configure grid weights for responsive design
        for i in range(2):
            camera_frame.grid_rowconfigure(i, weight=1)
            camera_frame.grid_columnconfigure(i, weight=1)
    
    def setup_admin_controls(self, parent):
        """Setup administrator control panel"""
        control_frame = tk.LabelFrame(parent, text="Administrator Controls", 
                                    font=('Arial', 12, 'bold'), bg='#34495e', fg='white')
        control_frame.pack(fill='x', padx=5, pady=5)
        
        # Detection controls
        detection_frame = tk.Frame(control_frame, bg='#34495e')
        detection_frame.pack(fill='x', padx=10, pady=10)
        
        tk.Label(detection_frame, text="Detection Systems:", 
                font=('Arial', 12, 'bold'), bg='#34495e', fg='white').pack(side='left')
        
        for detection_type in ["helmet", "seatbelt", "roundabout"]:
            btn_text = f"{detection_type.title()} Detection"
            color = '#27ae60' if self.detection_active[detection_type] else '#e74c3c'
            btn = tk.Button(detection_frame, text=btn_text, 
                           command=lambda dt=detection_type: self.toggle_detection(dt),
                           bg=color, fg='white', font=('Arial', 10))
            btn.pack(side='left', padx=5)
        
        # Admin functions
        admin_frame = tk.Frame(control_frame, bg='#34495e')
        admin_frame.pack(fill='x', padx=10, pady=5)
        
        tk.Button(admin_frame, text="View All Reports", command=self.view_all_reports,
                 bg='#3498db', fg='white', font=('Arial', 10)).pack(side='left', padx=5)
        
        tk.Button(admin_frame, text="System Settings", command=self.system_settings,
                 bg='#9b59b6', fg='white', font=('Arial', 10)).pack(side='left', padx=5)
        
        tk.Button(admin_frame, text="Export Data", command=self.export_data,
                 bg='#f39c12', fg='white', font=('Arial', 10)).pack(side='left', padx=5)
        
        tk.Button(admin_frame, text="User Management", command=self.user_management,
                 bg='#2c3e50', fg='white', font=('Arial', 10)).pack(side='left', padx=5)
    
    def setup_officer_controls(self, parent):
        """Setup traffic officer control panel"""
        control_frame = tk.LabelFrame(parent, text="Traffic Officer Controls", 
                                    font=('Arial', 12, 'bold'), bg='#34495e', fg='white')
        control_frame.pack(fill='x', padx=5, pady=5)
        
        officer_frame = tk.Frame(control_frame, bg='#34495e')
        officer_frame.pack(fill='x', padx=10, pady=10)
        
        tk.Button(officer_frame, text="Record Violation", command=self.record_violation,
                 bg='#e74c3c', fg='white', font=('Arial', 10)).pack(side='left', padx=5)
        
        tk.Button(officer_frame, text="View Daily Reports", command=self.view_daily_reports,
                 bg='#3498db', fg='white', font=('Arial', 10)).pack(side='left', padx=5)
        
        tk.Button(officer_frame, text="Generate Ticket", command=self.generate_ticket,
                 bg='#f39c12', fg='white', font=('Arial', 10)).pack(side='left', padx=5)
        
        # Detection toggle (limited)
        for detection_type in ["helmet", "seatbelt", "roundabout"]:
            btn_text = f"Toggle {detection_type.title()}"
            btn = tk.Button(officer_frame, text=btn_text, 
                           command=lambda dt=detection_type: self.toggle_detection(dt),
                           bg='#27ae60', fg='white', font=('Arial', 10))
            btn.pack(side='left', padx=5)
    
    def setup_public_controls(self, parent):
        """Setup public interface control panel"""
        control_frame = tk.LabelFrame(parent, text="Public Interface", 
                                    font=('Arial', 12, 'bold'), bg='#34495e', fg='white')
        control_frame.pack(fill='x', padx=5, pady=5)
        
        public_frame = tk.Frame(control_frame, bg='#34495e')
        public_frame.pack(fill='x', padx=10, pady=10)
        
        tk.Label(public_frame, text="Live Traffic Monitoring (View Only)", 
                font=('Arial', 12), bg='#34495e', fg='#ecf0f1').pack(side='left')
        
        tk.Button(public_frame, text="View Statistics", command=self.view_public_stats,
                 bg='#3498db', fg='white', font=('Arial', 10)).pack(side='right', padx=5)
    
    def setup_status_panel(self, parent):
        """Setup status and violations panel"""
        status_frame = tk.LabelFrame(parent, text="System Status & Violations", 
                                   font=('Arial', 12, 'bold'), bg='#34495e', fg='white')
        status_frame.pack(fill='x', padx=5, pady=5)
        
        # Status indicators
        status_grid = tk.Frame(status_frame, bg='#34495e')
        status_grid.pack(fill='x', padx=10, pady=10)
        
        # Violation counters
        for i, (violation_type, count) in enumerate(self.violation_count.items()):
            col = i % 3
            label = tk.Label(status_grid, text=f"{violation_type.title()} Violations: {count}", 
                           bg='#2c3e50', fg='white', font=('Arial', 10), 
                           relief='raised', padx=10, pady=5)
            label.grid(row=0, column=col, padx=5, pady=5, sticky='ew')
            self.status_labels.append(label)
        
        # System status
        self.system_status_label = tk.Label(status_grid, text="System Status: Ready", 
                                          bg='#27ae60', fg='white', font=('Arial', 10, 'bold'), 
                                          relief='raised', padx=10, pady=5)
        self.system_status_label.grid(row=1, column=0, columnspan=3, padx=5, pady=5, sticky='ew')
        
        # Configure grid weights
        for i in range(3):
            status_grid.grid_columnconfigure(i, weight=1)
    
    def start_camera(self, camera_idx):
        """Start camera feed"""
        try:
            if not self.camera_active[camera_idx]:
                self.cameras[camera_idx] = cv2.VideoCapture(camera_idx)
                if self.cameras[camera_idx].isOpened():
                    self.camera_active[camera_idx] = True
                    self.camera_thread = threading.Thread(
                        target=self.update_camera_feed, 
                        args=(camera_idx,), 
                        daemon=True
                    )
                    self.camera_thread.start()
                    self.update_system_status(f"Camera {camera_idx + 1} started")
                else:
                    messagebox.showerror("Error", f"Cannot access Camera {camera_idx + 1}")
        except Exception as e:
            messagebox.showerror("Camera Error", f"Error starting camera {camera_idx + 1}: {str(e)}")
    
    def stop_camera(self, camera_idx):
        """Stop camera feed"""
        if self.camera_active[camera_idx]:
            self.camera_active[camera_idx] = False
            if self.cameras[camera_idx]:
                self.cameras[camera_idx].release()
                self.cameras[camera_idx] = None
            
            # Reset camera display
            self.camera_frames[camera_idx].configure(
                image='', text=f"Camera {camera_idx + 1}\nNo Signal"
            )
            self.update_system_status(f"Camera {camera_idx + 1} stopped")
    
    def update_camera_feed(self, camera_idx):
        """Update camera feed with detection"""
        while self.camera_active[camera_idx]:
            try:
                ret, frame = self.cameras[camera_idx].read()
                if ret:
                    # Apply detection based on active systems
                    processed_frame = frame.copy()
                    
                    if self.detection_active["helmet"]:
                        processed_frame, helmet_violations = self.helmet_detector.detect(processed_frame)
                        if helmet_violations:
                            self.handle_violation("helmet", helmet_violations, camera_idx)
                    
                    if self.detection_active["seatbelt"]:
                        processed_frame, seatbelt_violations = self.seatbelt_detector.detect(processed_frame)
                        if seatbelt_violations:
                            self.handle_violation("seatbelt", seatbelt_violations, camera_idx)
                    
                    if self.detection_active["roundabout"]:
                        processed_frame, roundabout_violations = self.roundabout_detector.detect(processed_frame)
                        if roundabout_violations:
                            self.handle_violation("roundabout", roundabout_violations, camera_idx)
                    
                    # Convert and display frame
                    processed_frame = cv2.resize(processed_frame, (300, 200))       # Camera frame size
                    processed_frame = cv2.cvtColor(processed_frame, cv2.COLOR_BGR2RGB)
                    img = Image.fromarray(processed_frame)
                    img_tk = ImageTk.PhotoImage(img)
                    
                    self.camera_frames[camera_idx].configure(image=img_tk, text='')
                    self.camera_frames[camera_idx].image = img_tk
                    
            except Exception as e:
                print(f"Camera {camera_idx + 1} error: {e}")
                break
    
    def handle_violation(self, violation_type, violations, camera_idx):
    
        """Handle detected violations"""
        for violation in violations:
            self.violation_count[violation_type] += 1

        # Force conversion to dict for JSON safety
        if hasattr(violation, "to_dict"):
            violation_dict = violation.to_dict()
        elif hasattr(violation, "__dict__"):
            violation_dict = dict(violation.__dict__)
        elif isinstance(violation, dict):
            violation_dict = violation
        else:
            violation_dict = {"value": str(violation)}

        violation_data = {
            "type": violation_type,
            "camera_id": camera_idx + 1,
            "timestamp": datetime.datetime.now().isoformat(),
            "details": violation_dict,
            "officer": self.current_user if self.user_role == "Traffic Officer" else None
        }

        self.db_manager.save_violation(violation_data)
        self.update_violation_display()
    
    def update_violation_display(self):
        """Update violation count display"""
        for i, (violation_type, count) in enumerate(self.violation_count.items()):
            self.status_labels[i].configure(text=f"{violation_type.title()} Violations: {count}")
    
    def toggle_detection(self, detection_type):
        """Toggle detection system on/off"""
        self.detection_active[detection_type] = not self.detection_active[detection_type]
        status = "ON" if self.detection_active[detection_type] else "OFF"
        self.update_system_status(f"{detection_type.title()} detection: {status}")
    
    def update_system_status(self, message):
        """Update system status display"""
        self.system_status_label.configure(text=f"System Status: {message}")
        print(f"[{datetime.datetime.now()}] {message}")
    
    # Interface-specific methods
    def view_all_reports(self):
        """Admin: View all violation reports"""
        reports = self.db_manager.get_all_violations()
        self.show_reports_window("All Violation Reports", reports)
    
    def view_daily_reports(self):
        """Officer: View daily reports"""
        today = datetime.date.today()
        reports = self.db_manager.get_violations_by_date(today)
        self.show_reports_window(f"Daily Reports - {today}", reports)
    
    def view_public_stats(self):
        """Public: View violation statistics"""
        stats = self.db_manager.get_violation_statistics()
        self.show_stats_window(stats)
    
    def show_reports_window(self, title, reports):
        """Show reports in a new window"""
        report_window = tk.Toplevel(self.root)
        report_window.title(title)
        report_window.geometry("800x600")
        
        # Create treeview for reports
        tree = ttk.Treeview(report_window, columns=('Type', 'Camera', 'Time', 'Officer'), show='headings')
        tree.heading('Type', text='Violation Type')
        tree.heading('Camera', text='Camera')
        tree.heading('Time', text='Timestamp')
        tree.heading('Officer', text='Officer')
        
        for report in reports:
            tree.insert('', 'end', values=(
                report.get('type', ''),
                report.get('camera_id', ''),
                report.get('timestamp', ''),
                report.get('officer', 'System')
            ))
        
        tree.pack(fill='both', expand=True, padx=10, pady=10)
    
    def show_stats_window(self, stats):
        """Show statistics window"""
        stats_window = tk.Toplevel(self.root)
        stats_window.title("Traffic Violation Statistics")
        stats_window.geometry("400x300")
        
        for stat_type, count in stats.items():
            tk.Label(stats_window, text=f"{stat_type.title()} Violations: {count}", 
                    font=('Arial', 12)).pack(pady=10)
    
    def record_violation(self):
        """Officer: Manually record violation"""
        # Create manual violation entry window
        self.create_manual_violation_window()
    
    def create_manual_violation_window(self):
        """Create manual violation entry window"""
        violation_window = tk.Toplevel(self.root)
        violation_window.title("Record Manual Violation")
        violation_window.geometry("400x300")
        
        tk.Label(violation_window, text="Violation Type:").pack(pady=5)
        violation_type_var = tk.StringVar(value="helmet")
        ttk.Combobox(violation_window, textvariable=violation_type_var, 
                    values=["helmet", "seatbelt", "roundabout"]).pack(pady=5)
        
        tk.Label(violation_window, text="Camera ID:").pack(pady=5)
        camera_var = tk.StringVar(value="1")
        ttk.Combobox(violation_window, textvariable=camera_var, 
                    values=["1", "2", "3", "4"]).pack(pady=5)
        
        tk.Label(violation_window, text="Details:").pack(pady=5)
        details_text = tk.Text(violation_window, height=5, width=40)
        details_text.pack(pady=5)
        
        def save_manual_violation():
            violation_data = {
                'type': violation_type_var.get(),
                'camera_id': int(camera_var.get()),
                'timestamp': datetime.datetime.now(),
                'details': details_text.get('1.0', 'end-1c'),
                'officer': self.current_user
            }
            self.db_manager.save_violation(violation_data)
            self.violation_count[violation_type_var.get()] += 1
            self.update_violation_display()
            violation_window.destroy()
            messagebox.showinfo("Success", "Violation recorded successfully!")
        
        tk.Button(violation_window, text="Save Violation", 
                 command=save_manual_violation, bg='#e74c3c', fg='white').pack(pady=20)
    
    def generate_ticket(self):
        """Officer: Generate violation ticket"""
        messagebox.showinfo("Generate Ticket", "Ticket generation feature - Integration with ticketing system required")
    
    def system_settings(self):
        """Admin: System settings"""
        messagebox.showinfo("System Settings", "System configuration panel - To be implemented")
    
    def export_data(self):
        """Admin: Export data"""
        filename = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("CSV files", "*.csv")]
        )
        if filename:
            self.db_manager.export_data(filename)
            messagebox.showinfo("Export Complete", f"Data exported to {filename}")
    
    def user_management(self):
        """Admin: User management"""
        messagebox.showinfo("User Management", "User management panel - To be implemented")
    
    def logout(self):
        """Logout and return to login screen"""
        # Stop all cameras
        for i in range(4):
            if self.camera_active[i]:
                self.stop_camera(i)
        
        self.current_user = None
        self.user_role = None
        self.setup_login_interface()
    
    def run(self):
        """Run the application"""
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.mainloop()
    
    def on_closing(self):
        """Handle application closing"""
        # Stop all cameras
        for i in range(4):
            if self.camera_active[i]:
                self.stop_camera(i)
        
        self.root.quit()
        self.root.destroy()

if __name__ == "__main__":
    app = TrafficViolationSystem()
    app.run()