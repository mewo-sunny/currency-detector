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
    print("YOLO Model loaded successfully!")
    print("Classes:", model.names)
except Exception as e:
    print(f"Error loading model: {e}")


def fix_rotation(img):
    h, w = img.shape[:2]

    if h > w:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        print(f"Rotated image from {w}x{h} → {img.shape[1]}x{img.shape[0]}")

    return img


def update_buffer(current_detections):

    global detection_buffer
    now = time.time()

    for d in current_detections:

        center_x = (d['x1'] + d['x2']) / 2
        center_y = (d['y1'] + d['y2']) / 2

        spatial_id = f"{d['label']}_{int(center_x/50)}_{int(center_y/50)}"

        detection_buffer[spatial_id] = {
            "data": d,
            "timestamp": now
        }

    stale_keys = [
        k for k, v in detection_buffer.items()
        if now - v['timestamp'] > BUFFER_DURATION
    ]

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
            return jsonify({"status": "error", "message": "No image provided"}), 400

        file = request.files['image'].read()
        npimg = np.frombuffer(file, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"status": "error", "message": "Invalid image"}), 400

        # Fix phone rotation
        img = fix_rotation(img)

        img_h, img_w = img.shape[:2]

        # Resize for YOLO
        resized = cv2.resize(img, (640, 640))

        results = model(
            resized,
            conf=0.90,   # kept exactly as you asked
            iou=0.4,
            imgsz=640,
            agnostic_nms=True,
            verbose=False
        )

        current_frame_detections = []

        if len(results) > 0 and results[0].boxes is not None:

            for box in results[0].boxes:

                confidence = float(box.conf)
                coords = box.xyxy[0].tolist()
                label = model.names[int(box.cls)]

                # Scale box back to original image size
                scale_x = img_w / 640
                scale_y = img_h / 640

                x1 = coords[0] * scale_x
                y1 = coords[1] * scale_y
                x2 = coords[2] * scale_x
                y2 = coords[3] * scale_y

                box_w = x2 - x1
                box_h = y2 - y1

                box_area_ratio = (box_w * box_h) / (img_w * img_h)

                # Fix huge boxes instead of rejecting
                if box_area_ratio > 0.85:

                    print(f"⚠ Large box detected for {label} ({box_area_ratio:.2f}) — correcting")

                    shrink_w = img_w * 0.6
                    shrink_h = img_h * 0.4

                    cx = img_w / 2
                    cy = img_h / 2

                    x1 = cx - shrink_w / 2
                    x2 = cx + shrink_w / 2
                    y1 = cy - shrink_h / 2
                    y2 = cy + shrink_h / 2

                current_frame_detections.append({
                    "label": label,
                    "confidence": round(confidence, 2),
                    "x1": round(x1, 1),
                    "y1": round(y1, 1),
                    "x2": round(x2, 1),
                    "y2": round(y2, 1)
                })

        smoothed_detections = update_buffer(current_frame_detections)

        if len(smoothed_detections) > 0:
            labels = [d['label'] for d in smoothed_detections]
            print(f"Detected: {', '.join(labels)}")
        else:
            print("No detections this frame")

        return jsonify({
            "status": "success",
            "detections": smoothed_detections,
            "imgW": img_w,
            "imgH": img_h
        })

    except Exception as e:
        print("Server Error:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)