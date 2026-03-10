from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import numpy as np
import cv2
import logging
import time

app = Flask(__name__)
CORS(app)

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# --- SMOOTHING CONFIGURATION ---
detection_buffer = {}
BUFFER_DURATION = 1.5

model = None
try:
    model = YOLO('last.pt')
    print(" YOLO Model loaded successfully!")
except Exception as e:
    print(f" Error loading model: {e}")


def fix_rotation(img):
    """
    Android snapshots are often rotated 90° or 270°.
    We force the image to always be landscape (wider than tall)
    so coordinates are consistent with what the phone camera renders.
    
    If boxes appear mirrored, swap ROTATE_90_CLOCKWISE → ROTATE_90_COUNTERCLOCKWISE
    """
    h, w = img.shape[:2]
    if h > w:
        # Portrait image from Android — rotate 90° clockwise to landscape
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        print(f" Rotated image from {w}x{h} → {img.shape[1]}x{img.shape[0]}")
    return img


def update_buffer(current_detections):
    """
    Spatial-temporal buffer: tracks each note by its center position.
    Allows multiple notes of the same denomination to coexist.
    """
    global detection_buffer
    now = time.time()

    for d in current_detections:
        center_x = (d['x1'] + d['x2']) / 2
        center_y = (d['y1'] + d['y2']) / 2
        spatial_id = f"{d['label']}_{int(center_x / 50)}_{int(center_y / 50)}"

        detection_buffer[spatial_id] = {
            "data": d,
            "timestamp": now
        }

    stale_keys = [k for k, v in detection_buffer.items() if now - v['timestamp'] > BUFFER_DURATION]
    for k in stale_keys:
        del detection_buffer[k]

    return [v['data'] for v in detection_buffer.values()]

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "server": "currency detector API",
        "status": "running"
    })

@app.route('/scan', methods=['POST'])
def scan():
    if model is None:
        return jsonify({"status": "error", "message": "Model not loaded"}), 500

    try:
        if 'image' not in request.files:
            return jsonify({"status": "error", "message": "No image in request"}), 400

        file = request.files['image'].read()
        npimg = np.frombuffer(file, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"status": "error", "message": "Invalid image data"}), 400

        # ✅ FIX 1: Correct Android rotation BEFORE running inference
        # This ensures imgW/imgH match what the phone actually renders on screen
        img = fix_rotation(img)
        img_h, img_w = img.shape[:2]

        # ✅ FIX 2: Single confidence threshold — no double-filtering
        # agnostic_nms=True is the KEY fix for detecting 2x same denomination notes
        results = model(
            img,
            conf=0.90,
            iou=0.4,
            imgsz=640,
            agnostic_nms=True,  # Allows two Rs.500 notes to both survive NMS
            verbose=False
        )

        current_frame_detections = []

        if len(results) > 0 and results[0].boxes:
            for box in results[0].boxes:
                confidence = float(box.conf)
                coords = box.xyxy[0].tolist()
                label = model.names[int(box.cls)]

                # ✅ FIX 3: Reject full-screen boxes (bad detections)
                box_w = coords[2] - coords[0]
                box_h = coords[3] - coords[1]
                box_area_ratio = (box_w * box_h) / (img_w * img_h)

                if box_area_ratio > 0.85:
                    print(f"⚠️  Skipping full-screen box for '{label}' (area: {box_area_ratio:.2f})")
                    continue

                current_frame_detections.append({
                    "label": label,
                    "confidence": round(confidence, 2),
                    "x1": round(coords[0], 1),
                    "y1": round(coords[1], 1),
                    "x2": round(coords[2], 1),
                    "y2": round(coords[3], 1),
                })

        smoothed_detections = update_buffer(current_frame_detections)

        if len(smoothed_detections) > 1:
            labels = [d['label'] for d in smoothed_detections]
            print(f" MULTI-SCAN: {', '.join(labels)}")
        elif len(smoothed_detections) == 1:
            d = smoothed_detections[0]
            print(f" Detected: {d['label']} ({d['confidence']}) @ [{d['x1']:.0f},{d['y1']:.0f} → {d['x2']:.0f},{d['y2']:.0f}]")
        else:
            print(" No detections this frame")

        return jsonify({
            "status": "success",
            "detections": smoothed_detections,
            "imgW": img_w,
            "imgH": img_h
        })

    except Exception as e:
        print(f" Server Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
