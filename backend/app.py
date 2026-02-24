from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io
from collections import Counter 

app = Flask(__name__)

# 1. Configuration
MODEL_PATH = "currency.tflite"
LABEL_PATH = "labels.txt"

# 2. Load Model and Labels
interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()

with open(LABEL_PATH, 'r') as f:
    labels = [line.strip() for line in f.readlines()]

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
height = input_details[0]['shape'][1]
width = input_details[0]['shape'][2]

@app.route('/predict', methods=['POST'])
def predict():
    try:
        files = request.files.getlist('file')
        
        if not files:
            return jsonify({'result': 'No files uploaded'}), 400

        predictions_list = []
        confidences_list = []

        # 3. Process each image in the burst
        for file in files:
            img_bytes = file.read()
            img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
            img = img.resize((width, height))
            
            input_data = np.expand_dims(img, axis=0).astype(np.float32)

            interpreter.set_tensor(input_details[0]['index'], input_data)
            interpreter.invoke()

            output_data = interpreter.get_tensor(output_details[0]['index'])[0]
            best_index = np.argmax(output_data)
            
            predictions_list.append(labels[best_index])
            confidences_list.append(float(output_data[best_index]))

        # 4. Majority Voting Logic
        counts = Counter(predictions_list)
        final_result, occurance_count = counts.most_common(1)[0]
        
        # Calculate average confidence for the most frequent result
        relevant_confidences = [confidences_list[i] for i, res in enumerate(predictions_list) if res == final_result]
        avg_confidence = np.mean(relevant_confidences)

        # 5. Confidence Threshold Logic (The Else Part)
        if avg_confidence >= 0.70:
            display_text = final_result
        else:
            # You can customize this message
            display_text = "Note not detected"

        print(f"Results: {predictions_list} | Final: {display_text} ({avg_confidence:.2f})")

        return jsonify({
            'result': display_text,
            'confidence': round(avg_confidence, 2),
            'raw_label': final_result # Keep the original guess for debugging
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'result': "Error processing image"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)