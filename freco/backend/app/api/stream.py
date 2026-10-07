import base64
import json
import logging
from typing import Any
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
from app.ml.pose_estimator import estimate_pose
from app.ml.face_detector import NoFaceDetectedError
from app.ml.resource_manager import resource_manager
from app.utils.image_utils import decode_uploaded_image

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/stream")
async def face_stream(websocket: WebSocket):
    await websocket.accept()
    pipeline = await resource_manager.get_pipeline_async()
    if not pipeline:
        await websocket.close(code=1011, reason="Pipeline not initialized")
        return

    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                payload = json.loads(text_data)
                mode = payload.get("mode", "single_recognition")
                frame_data = payload.get("frame")  # base64 data URI
                
                if not frame_data:
                    await websocket.send_json({"error": "No frame data"})
                    continue
                    
                # Extract base64 part if it's a data URI
                if "," in frame_data:
                    frame_data = frame_data.split(",")[1]
                    
                image_bytes = base64.b64decode(frame_data)
                image_bgr = decode_uploaded_image(image_bytes)
                
                # We can't do heavy inference in the async event loop directly. Use threadpool.
                response = await run_in_threadpool(process_frame, pipeline, image_bgr, mode)
                try:
                    await websocket.send_json(response)
                except WebSocketDisconnect:
                    # Browser navigation/teardown is normal; never try to
                    # send an error after a closed socket.
                    break
                
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.exception("Error processing frame")
                try:
                    await websocket.send_json({"error": "Frame processing failed"})
                except WebSocketDisconnect:
                    break
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")


def process_frame(pipeline, image_bgr: np.ndarray, mode: str) -> dict[str, Any]:
    models = pipeline._models.snapshot()
    
    if mode == "registration" or mode == "single_recognition":
        try:
            face = models.detector.detect_single(image_bgr)
            
            # Estimate pose
            h, w = image_bgr.shape[:2]
            pose = estimate_pose(face.landmarks)
            
            # Calculate liveness if recognition mode
            is_live = False
            liveness_score = 0.0
            if mode == "single_recognition":
                is_live, liveness_score = models.liveness_detector.predict(image_bgr, face.bbox)
                
            return {
                "status": "face_detected",
                "faces": [{
                    "bbox": face.bbox.astype(float).tolist(),
                    "detection_score": face.det_score,
                    "pose": pose,
                    "is_live": is_live,
                    "liveness_score": liveness_score,
                }]
            }
        except NoFaceDetectedError:
            return {"status": "no_face_detected", "faces": []}
        except Exception as e:
            return {"status": "error", "error": str(e)}
            
    elif mode == "multi_recognition":
        try:
            faces = models.detector.detect(image_bgr)
            if not faces:
                return {"status": "no_face_detected", "faces": []}
                
            results = []
            for face in faces:
                pose = estimate_pose(face.landmarks)
                is_live, liveness_score = models.liveness_detector.predict(image_bgr, face.bbox)
                results.append({
                    "bbox": face.bbox.astype(float).tolist(),
                    "detection_score": face.det_score,
                    "pose": pose,
                    "is_live": is_live,
                    "liveness_score": liveness_score,
                })
                
            return {
                "status": "faces_detected",
                "faces": results
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
            
    return {"status": "error", "error": f"Unknown mode: {mode}"}
