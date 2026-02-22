from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io

app = Flask(__name__)

# Load your model once when the server starts
interpreter = tf.lite.Interpreter(model_path="currency.tflite")
interpreter.allocate_tensors()

def prepare_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((224, 224)) # Adjust based on your model's input size
    return np.expand_dims(np.array(img, dtype=np.float32) / 255.0, axis=0)

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'no file'}), 400
    
    file = request.files['file'].read()
    input_data = prepare_image(file)

    # Run inference
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    
    output_data = interpreter.get_tensor(output_details[0]['index'])
    prediction = int(np.argmax(output_data))
    
    # Map prediction index to your labels
    labels = ["5 USD", "10 USD", "20 USD"] # Update this to match your labels.txt
    return jsonify({'result': labels[prediction]})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)