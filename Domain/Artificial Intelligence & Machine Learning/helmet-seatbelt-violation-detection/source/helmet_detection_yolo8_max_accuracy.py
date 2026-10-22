#!/usr/bin/env python3

"""
YOLOv8x-based Helmet Detection Module
Optimized for Traffic Safety System GUI Integration
"""

import cv2
import numpy as np
import datetime
from dataclasses import dataclass
from typing import List, Tuple, Optional
import json
import os
from pathlib import Path

# YOLOv8 imports
try:
    from ultralytics import YOLO
    import torch
    YOLO_AVAILABLE = True
except ImportError as e:
    YOLO_AVAILABLE = False
    print(f"Error: YOLOv8 not available: {e}")
    print("Install with: pip install ultralytics torch torchvision")


@dataclass
class HelmetViolation:
    """Data structure for helmet violations"""
    rider_bbox: Tuple[int, int, int, int]  # x, y, width, height
    helmet_bbox: Optional[Tuple[int, int, int, int]]  # helmet box if detected
    confidence: float
    timestamp: datetime.datetime
    violation_id: str
    detection_type: str  # "no_helmet", "improper_helmet", etc.
    camera_id: int = 0  # Camera identifier for multi-camera setup


class YOLOv8xHelmetDetector:
    """YOLOv8x-based helmet detection optimized for accuracy"""
    
    def __init__(self, 
                 confidence_threshold: float = 0.6,
                 iou_threshold: float = 0.45,
                 device: str = 'auto',
                 custom_model_path: Optional[str] = None):
        """
        Initialize YOLOv8x helmet detection system
        
        Args:
            confidence_threshold: Minimum confidence for detection (default: 0.6 for accuracy)
            iou_threshold: IoU threshold for NMS
            device: Device to run inference on ('auto', 'cpu', 'cuda', 'mps')
            custom_model_path: Path to custom trained helmet model (if available)
        """
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.device = device
        self.violation_count = 0
        self.frame_count = 0
        self.custom_model_path = custom_model_path
        
        # YOLOv8x model (most accurate)
        self.model_path = custom_model_path if custom_model_path and os.path.exists(custom_model_path) else "yolov8x.pt"
        self.model = None
        self.using_custom_model = False
        
        # Custom class mappings for helmet detection
        self.helmet_classes = {
            'person': 0,
            'helmet': 1,
            'no_helmet': 2,
            'motorcycle': 3,
            'bicycle': 4
        }
        
        # Color mapping for visualization
        self.class_colors = {
            'person': (255, 0, 0),      # Blue
            'helmet': (0, 255, 0),      # Green
            'no_helmet': (0, 0, 255),   # Red
            'motorcycle': (0, 255, 255), # Yellow
            'bicycle': (255, 255, 0),   # Cyan
            'violation': (0, 0, 255)    # Red for violations
        }
        
        # Initialize detection system
        self.setup_model()
        
        # Tracking variables for multi-camera support
        self.tracked_objects = {}
        self.camera_violations = {}

    def setup_model(self):
        """Setup YOLOv8x model for helmet detection"""
        if not YOLO_AVAILABLE:
            raise ImportError("YOLOv8 (ultralytics) is required. Install with: pip install ultralytics torch torchvision")
            
        try:
            # Check if custom helmet model exists
            if self.custom_model_path and os.path.exists(self.custom_model_path):
                print(f"Loading custom helmet detection model: {self.custom_model_path}")
                self.model = YOLO(self.custom_model_path)
                self.using_custom_model = True
                
                # Get class names from custom model
                if hasattr(self.model.model, 'names'):
                    self.class_names = self.model.model.names
                else:
                    self.class_names = list(self.helmet_classes.keys())
                    
            else:
                # Use YOLOv8x pretrained model (most accurate)
                print("Loading YOLOv8x model (most accurate)...")
                self.model = YOLO("yolov8x.pt")
                self.using_custom_model = False
                self.class_names = self.model.model.names
                
            # Set device
            if self.device == 'auto':
                if torch.cuda.is_available():
                    self.device = 'cuda'
                elif torch.backends.mps.is_available():  # Apple Silicon
                    self.device = 'mps'
                else:
                    self.device = 'cpu'
                    
            print(f"YOLOv8x model loaded successfully on device: {self.device}")
            print(f"Model type: {'Custom Helmet Model' if self.using_custom_model else 'YOLOv8x Pretrained'}")
            
            # Warm up model
            dummy_img = np.zeros((640, 640, 3), dtype=np.uint8)
            _ = self.model(dummy_img, device=self.device, verbose=False)
            print("Model warmed up successfully")
            
        except Exception as e:
            print(f"Error loading YOLOv8x model: {e}")
            raise

    def detect(self, frame: np.ndarray, camera_id: int = 0) -> Tuple[np.ndarray, List[HelmetViolation]]:
        """
        Detect helmet violations using YOLOv8x
        
        Args:
            frame: Input video frame
            camera_id: Camera identifier for multi-camera setup
            
        Returns:
            Tuple of (processed_frame, violations_list)
        """
        violations = []
        processed_frame = frame.copy()
        self.frame_count += 1
        
        # Initialize camera tracking if needed
        if camera_id not in self.camera_violations:
            self.camera_violations[camera_id] = 0
        
        try:
            # Get YOLOv8x detections
            detections = self.get_detections(frame)
            
            # Process detections for violations
            violations = self.process_detections(detections, frame, camera_id)
            
            # Draw detections and violations
            processed_frame = self.draw_detections(processed_frame, detections, violations, camera_id)
            
            # Update camera violation count
            self.camera_violations[camera_id] += len(violations)
            
        except Exception as e:
            print(f"Error in helmet detection for camera {camera_id}: {e}")
            cv2.putText(processed_frame, f"DETECTION ERROR CAM {camera_id}", 
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        
        return processed_frame, violations

    def get_detections(self, frame: np.ndarray) -> List[dict]:
        """Get YOLOv8x detections from frame"""
        detections = []
        
        try:
            # Run YOLOv8x inference
            results = self.model(
                frame, 
                conf=self.confidence_threshold,
                iou=self.iou_threshold,
                device=self.device,
                verbose=False
            )
            
            # Process results
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Extract box information
                        xyxy = box.xyxy[0].cpu().numpy()  # [x1, y1, x2, y2]
                        conf = float(box.conf[0].cpu().numpy())
                        cls = int(box.cls[0].cpu().numpy())
                        
                        # Convert xyxy to xywh
                        x1, y1, x2, y2 = xyxy
                        x, y, w, h = x1, y1, x2 - x1, y2 - y1
                        
                        # Get class name
                        if isinstance(self.class_names, dict):
                            class_name = self.class_names.get(cls, f"class_{cls}")
                        else:
                            class_name = self.class_names[cls] if cls < len(self.class_names) else f"class_{cls}"
                        
                        detection = {
                            'bbox': (int(x), int(y), int(w), int(h)),
                            'confidence': conf,
                            'class_id': cls,
                            'class_name': class_name,
                            'center': (int(x + w/2), int(y + h/2)),
                            'xyxy': xyxy.astype(int)
                        }
                        
                        detections.append(detection)
            
        except Exception as e:
            print(f"Error in YOLOv8x detection: {e}")
            
        return detections

    def process_detections(self, detections: List[dict], frame: np.ndarray, camera_id: int) -> List[HelmetViolation]:
        """Process YOLOv8x detections to identify helmet violations"""
        violations = []
        
        if self.using_custom_model:
            violations = self.process_custom_helmet_detections(detections, frame, camera_id)
        else:
            violations = self.process_coco_detections(detections, frame, camera_id)
        
        return violations

    def process_custom_helmet_detections(self, detections: List[dict], frame: np.ndarray, camera_id: int) -> List[HelmetViolation]:
        """Process detections from custom helmet model"""
        violations = []
        
        # Separate detections by class
        persons = [d for d in detections if d['class_name'] == 'person']
        helmets = [d for d in detections if d['class_name'] == 'helmet']
        no_helmets = [d for d in detections if d['class_name'] == 'no_helmet']
        motorcycles = [d for d in detections if d['class_name'] in ['motorcycle', 'bicycle']]
        
        # Method 1: Direct no_helmet detections
        for no_helmet_det in no_helmets:
            violation = HelmetViolation(
                rider_bbox=no_helmet_det['bbox'],
                helmet_bbox=None,
                confidence=no_helmet_det['confidence'],
                timestamp=datetime.datetime.now(),
                violation_id=f"CAM{camera_id}_HELMET_{self.violation_count:06d}",
                detection_type="no_helmet_detected",
                camera_id=camera_id
            )
            violations.append(violation)
            self.violation_count += 1
        
        # Method 2: Person detection without nearby helmet
        for person in persons:
            # Check if person is near a motorcycle
            near_motorcycle = self.is_near_vehicle(person, motorcycles)
            
            if near_motorcycle:
                # Check if there's a helmet detection near this person
                has_helmet = self.has_nearby_helmet(person, helmets)
                
                if not has_helmet:
                    violation = HelmetViolation(
                        rider_bbox=person['bbox'],
                        helmet_bbox=None,
                        confidence=person['confidence'],
                        timestamp=datetime.datetime.now(),
                        violation_id=f"CAM{camera_id}_HELMET_{self.violation_count:06d}",
                        detection_type="person_no_helmet",
                        camera_id=camera_id
                    )
                    violations.append(violation)
                    self.violation_count += 1
        
        return violations

    def process_coco_detections(self, detections: List[dict], frame: np.ndarray, camera_id: int) -> List[HelmetViolation]:
        """Process detections from COCO pretrained model using CV analysis"""
        violations = []
        
        # Separate detections by class
        persons = [d for d in detections if d['class_name'] == 'person']
        motorcycles = [d for d in detections if d['class_name'] in ['motorcycle', 'bicycle']]
        
        # Find riders on motorcycles and check for helmets using CV
        for motorcycle in motorcycles:
            riders_on_bike = self.find_riders_on_vehicle(motorcycle, persons)
            
            for rider in riders_on_bike:
                # Use CV methods to check for helmet
                helmet_status = self.check_helmet_with_cv(frame, rider)
                
                if not helmet_status['has_helmet']:
                    violation = HelmetViolation(
                        rider_bbox=rider['bbox'],
                        helmet_bbox=None,
                        confidence=helmet_status['confidence'],
                        timestamp=datetime.datetime.now(),
                        violation_id=f"CAM{camera_id}_HELMET_{self.violation_count:06d}",
                        detection_type=f"coco_cv_{helmet_status['method']}",
                        camera_id=camera_id
                    )
                    violations.append(violation)
                    self.violation_count += 1
        
        return violations

    def check_helmet_with_cv(self, frame: np.ndarray, rider: dict) -> dict:
        """Check helmet using computer vision analysis"""
        x, y, w, h = rider['bbox']
        
        # Extract head region (upper 25% of rider)
        head_y = max(0, y)
        head_h = max(10, int(h * 0.25))  # Ensure minimum height
        head_region = frame[head_y:head_y + head_h, x:x + w]
        
        if head_region.size == 0:
            return {'has_helmet': False, 'confidence': 0.0, 'method': 'no_head_region'}
        
        # Convert to different color spaces
        gray_head = cv2.cvtColor(head_region, cv2.COLOR_BGR2GRAY)
        hsv_head = cv2.cvtColor(head_region, cv2.COLOR_BGR2HSV)
        
        # Multiple analysis methods
        shape_result = self.analyze_helmet_shape(gray_head)
        color_result = self.analyze_helmet_color(hsv_head)
        
        # Combine results (weighted average)
        if shape_result['confidence'] > 0.7:
            return shape_result
        elif color_result['confidence'] > 0.6:
            return color_result
        else:
            # Default to more conservative approach
            return {'has_helmet': False, 'confidence': 0.8, 'method': 'cv_analysis'}

    def analyze_helmet_shape(self, gray_head: np.ndarray) -> dict:
        """Analyze head shape for helmet detection"""
        try:
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray_head, (5, 5), 0)
            
            # Edge detection
            edges = cv2.Canny(blurred, 30, 100)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                return {'has_helmet': False, 'confidence': 0.2, 'method': 'no_contours'}
            
            # Analyze largest contour
            largest_contour = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_contour)
            perimeter = cv2.arcLength(largest_contour, True)
            
            if perimeter == 0 or area < 100:
                return {'has_helmet': False, 'confidence': 0.2, 'method': 'small_contour'}
            
            # Circularity analysis (helmets are more circular)
            circularity = 4 * np.pi * area / (perimeter * perimeter)
            
            # Helmet shape analysis
            if circularity > 0.65:
                confidence = min(0.9, circularity + 0.2)
                return {'has_helmet': True, 'confidence': confidence, 'method': 'circular_shape'}
            else:
                confidence = 1.0 - circularity
                return {'has_helmet': False, 'confidence': confidence, 'method': 'irregular_shape'}
        
        except Exception as e:
            return {'has_helmet': False, 'confidence': 0.1, 'method': 'shape_error'}

    def analyze_helmet_color(self, hsv_head: np.ndarray) -> dict:
        """Analyze color uniformity for helmet detection"""
        try:
            # Analyze value (brightness) and saturation channels
            value_channel = hsv_head[:, :, 2]
            sat_channel = hsv_head[:, :, 1]
            
            brightness_std = np.std(value_channel)
            saturation_mean = np.mean(sat_channel)
            
            # Helmets typically have:
            # 1. More uniform brightness (lower std)
            # 2. Often solid colors (specific saturation patterns)
            
            uniform_brightness = brightness_std < 30
            solid_color = saturation_mean > 50 and saturation_mean < 200
            
            if uniform_brightness and solid_color:
                return {'has_helmet': True, 'confidence': 0.75, 'method': 'uniform_color'}
            elif uniform_brightness:
                return {'has_helmet': True, 'confidence': 0.6, 'method': 'uniform_brightness'}
            else:
                return {'has_helmet': False, 'confidence': 0.7, 'method': 'varied_texture'}
        
        except Exception as e:
            return {'has_helmet': False, 'confidence': 0.1, 'method': 'color_error'}

    def is_near_vehicle(self, person: dict, vehicles: List[dict], distance_threshold: float = 120) -> bool:
        """Check if person is near a motorcycle/bicycle"""
        person_center = person['center']
        
        for vehicle in vehicles:
            vehicle_center = vehicle['center']
            distance = np.sqrt((person_center[0] - vehicle_center[0])**2 + 
                             (person_center[1] - vehicle_center[1])**2)
            
            if distance < distance_threshold:
                return True
        
        return False

    def has_nearby_helmet(self, person: dict, helmets: List[dict], distance_threshold: float = 100) -> bool:
        """Check if there's a helmet detection near the person"""
        person_x, person_y, person_w, person_h = person['bbox']
        person_head_center = (person_x + person_w//2, person_y + int(person_h * 0.15))
        
        for helmet in helmets:
            helmet_center = helmet['center']
            distance = np.sqrt((person_head_center[0] - helmet_center[0])**2 + 
                             (person_head_center[1] - helmet_center[1])**2)
            
            if distance < distance_threshold:
                return True
        
        return False

    def find_riders_on_vehicle(self, vehicle: dict, persons: List[dict]) -> List[dict]:
        """Find persons who are riding the vehicle"""
        riders = []
        vehicle_x, vehicle_y, vehicle_w, vehicle_h = vehicle['bbox']
        
        for person in persons:
            person_x, person_y, person_w, person_h = person['bbox']
            
            # Check overlap and spatial relationship
            overlap = self.calculate_overlap((person_x, person_y, person_w, person_h),
                                           (vehicle_x, vehicle_y, vehicle_w, vehicle_h))
            
            # Check if person is positioned appropriately relative to motorcycle
            vertical_alignment = (person_y + person_h >= vehicle_y and 
                                person_y <= vehicle_y + vehicle_h)
            
            if overlap > 0.05 or vertical_alignment:
                riders.append(person)
        
        return riders

    def calculate_overlap(self, bbox1: Tuple[int, int, int, int], 
                         bbox2: Tuple[int, int, int, int]) -> float:
        """Calculate overlap ratio between two bounding boxes"""
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2
        
        # Calculate intersection
        xi1 = max(x1, x2)
        yi1 = max(y1, y2)
        xi2 = min(x1 + w1, x2 + w2)
        yi2 = min(y1 + h1, y2 + h2)
        
        if xi2 <= xi1 or yi2 <= yi1:
            return 0.0
        
        intersection = (xi2 - xi1) * (yi2 - yi1)
        union = w1 * h1 + w2 * h2 - intersection
        
        return intersection / union if union > 0 else 0.0

    def draw_detections(self, frame: np.ndarray, detections: List[dict], 
                       violations: List[HelmetViolation], camera_id: int) -> np.ndarray:
        """Draw detections and violations on frame"""
        
        # Draw all detections
        for detection in detections:
            x, y, w, h = detection['bbox']
            class_name = detection['class_name']
            confidence = detection['confidence']
            
            # Choose color based on class
            color = self.class_colors.get(class_name, (128, 128, 128))
            
            # Draw bounding box
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            
            # Add label with confidence
            label = f"{class_name}: {confidence:.2f}"
            (label_width, label_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            
            # Draw label background
            cv2.rectangle(frame, (x, y - label_height - 10), 
                         (x + label_width, y), color, -1)
            
            # Draw label text
            cv2.putText(frame, label, (x, y - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        
        # Draw violations with special highlighting
        for violation in violations:
            x, y, w, h = violation.rider_bbox
            
            # Draw thick red box for violations
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 4)
            
            # Add violation text
            violation_text = "HELMET VIOLATION"
            (text_width, text_height), _ = cv2.getTextSize(violation_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            
            # Draw text background
            cv2.rectangle(frame, (x, y - text_height - 15), 
                         (x + text_width, y - 5), (0, 0, 255), -1)
            
            # Draw violation text
            cv2.putText(frame, violation_text, (x, y - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Add violation ID
            id_text = f"ID: {violation.violation_id}"
            cv2.putText(frame, id_text, (x, y + h + 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            
            # Add warning icon
            cv2.circle(frame, (x - 20, y + 20), 15, (0, 0, 255), -1)
            cv2.putText(frame, "!", (x - 27, y + 28), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Add frame information
        self.add_frame_info(frame, len(violations), camera_id)
        
        return frame

    def add_frame_info(self, frame: np.ndarray, violation_count: int, camera_id: int):
        """Add frame information and statistics"""
        height, width = frame.shape[:2]
        
        # Camera info
        cv2.putText(frame, f"Camera {camera_id}", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Current violations
        cv2.putText(frame, f"Violations: {violation_count}", (10, height - 80), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Total for this camera
        cam_total = self.camera_violations.get(camera_id, 0)
        cv2.putText(frame, f"Cam {camera_id} Total: {cam_total}", (10, height - 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        # Model status
        model_status = f"YOLOv8x {'Custom' if self.using_custom_model else 'Standard'}"
        cv2.putText(frame, model_status, (10, height - 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        
        # Device info
        cv2.putText(frame, f"Device: {self.device}", (10, height - 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    def save_violation_log(self, violations: List[HelmetViolation], filename: str = "helmet_violations.json"):
        """Save violations to JSON file"""
        violation_data = []
        
        for violation in violations:
            violation_dict = {
                'violation_id': violation.violation_id,
                'timestamp': violation.timestamp.isoformat(),
                'camera_id': violation.camera_id,
                'rider_bbox': violation.rider_bbox,
                'helmet_bbox': violation.helmet_bbox,
                'confidence': violation.confidence,
                'detection_type': violation.detection_type
            }
            violation_data.append(violation_dict)
        
        try:
            # Load existing data if file exists
            if os.path.exists(filename):
                with open(filename, 'r') as f:
                    existing_data = json.load(f)
            else:
                existing_data = []
            
            # Add new violations
            existing_data.extend(violation_data)
            
            # Save updated data
            with open(filename, 'w') as f:
                json.dump(existing_data, f, indent=2)
                
            print(f"Saved {len(violation_data)} violations to {filename}")
            
        except Exception as e:
            print(f"Error saving violations: {e}")

    def violations_to_dict(self, violations: List[HelmetViolation]) -> List[dict]:
        """Convert HelmetViolation objects to JSON-serializable dictionaries"""
        violation_dicts = []
        for violation in violations:
            violation_dict = {
                'violation_id': violation.violation_id,
                'timestamp': violation.timestamp.isoformat(),
                'camera_id': violation.camera_id,
                'rider_bbox': violation.rider_bbox,
                'helmet_bbox': violation.helmet_bbox,
                'confidence': violation.confidence,
                'detection_type': violation.detection_type
            }
            violation_dicts.append(violation_dict)
        return violation_dicts

    def get_statistics(self) -> dict:
        """Get detection statistics"""
        return {
            'total_violations': self.violation_count,
            'frames_processed': self.frame_count,
            'yolov8x_loaded': self.model is not None,
            'model_path': self.model_path,
            'device': self.device,
            'using_custom_model': self.using_custom_model,
            'confidence_threshold': self.confidence_threshold,
            'iou_threshold': self.iou_threshold,
            'camera_violations': dict(self.camera_violations)
        }

    def reset_statistics(self):
        """Reset detection statistics"""
        self.violation_count = 0
        self.frame_count = 0
        self.camera_violations.clear()
        self.tracked_objects.clear()

    def set_confidence_threshold(self, threshold: float):
        """Update confidence threshold"""
        self.confidence_threshold = max(0.1, min(0.95, threshold))

    def is_model_ready(self) -> bool:
        """Check if model is ready for detection"""
        return self.model is not None

    def get_model_info(self) -> dict:
        """Get model information"""
        return {
            'model_name': 'YOLOv8x',
            'model_path': self.model_path,
            'custom_model': self.using_custom_model,
            'device': self.device,
            'ready': self.is_model_ready()
        }


# Convenience function for easy integration
def create_helmet_detector(custom_model_path: Optional[str] = None, 
                          confidence_threshold: float = 0.6,
                          device: str = 'auto') -> YOLOv8xHelmetDetector:
    """
    Create a YOLOv8x helmet detector instance
    
    Args:
        custom_model_path: Path to custom trained helmet model (optional)
        confidence_threshold: Detection confidence threshold
        device: Computing device ('auto', 'cpu', 'cuda', 'mps')
    
    Returns:
        YOLOv8xHelmetDetector instance
    """
    return YOLOv8xHelmetDetector(
        confidence_threshold=confidence_threshold,
        device=device,
        custom_model_path=custom_model_path
    )


if __name__ == "__main__":
    # Simple test for the module
    print("YOLOv8x Helmet Detection Module")
    print("=" * 50)
    
    try:
        # Create detector
        detector = create_helmet_detector()
        
        # Print model info
        model_info = detector.get_model_info()
        print("Model Information:")
        for key, value in model_info.items():
            print(f"  {key}: {value}")
        
        print("\nModule ready for integration with main.py")
        
    except Exception as e:
        print(f"Error initializing detector: {e}")
        print("Please ensure ultralytics and torch are installed:")
        print("pip install ultralytics torch torchvision")