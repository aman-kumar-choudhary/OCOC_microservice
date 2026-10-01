import numpy as np

def estimate_pose(landmarks: np.ndarray) -> str:
    """Estimate face pose (center, left, right, chin_up, chin_down) based on 5 landmarks."""
    if landmarks.shape != (5, 2):
        return "unknown"
    left_eye, right_eye, nose, left_mouth, right_mouth = landmarks
    
    eye_min_x = min(left_eye[0], right_eye[0])
    eye_max_x = max(left_eye[0], right_eye[0])
    
    eye_width = eye_max_x - eye_min_x
    if eye_width <= 0:
        return "unknown"   
    h_ratio = (nose[0] - eye_min_x) / eye_width
    
    eye_midpoint_y = (left_eye[1] + right_eye[1]) / 2.0
    mouth_midpoint_y = (left_mouth[1] + right_mouth[1]) / 2.0
    
    vertical_span = mouth_midpoint_y - eye_midpoint_y
    if vertical_span <= 0:
        return "unknown"
        
    v_ratio = (nose[1] - eye_midpoint_y) / vertical_span
    
    if h_ratio < 0.35:
        return "right"
    elif h_ratio > 0.65:
        return "left"
        
    if v_ratio < 0.40:
        return "chin_up"
    elif v_ratio > 0.65:
        return "chin_down"
        
    return "center"
