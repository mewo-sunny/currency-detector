import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import * as Speech from 'expo-speech'; 
import { getCurrencyFromAPI } from '../../src/ml/onlineModel';

export default function ScanScreen() {
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (camera.current == null) return;

    try {
      setLoading(true);
      setResult("Analyzing...");

      // 1. Capture the image safely
      const photo = await camera.current.takePhoto({
        flash: 'auto',
        enableShutterSound: true,
      });

      console.log("Image captured at:", photo.path);

      // 2. Call the Flask API using the updated IP logic
      const prediction = await getCurrencyFromAPI(photo.path);
      
      // 3. Update UI and trigger Text-to-Speech
      setResult(prediction);
      Speech.speak(`Detected ${prediction}`, { pitch: 1.0, rate: 0.9 });

    } catch (error) {
      console.error("Scan Error:", error);
      setResult("Scan Failed");
      Speech.speak("Identify failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (device == null) return (
    <View style={styles.container}>
      <Text style={styles.msg}>Connecting to Camera...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
      />

      <View style={styles.overlay}>
        {result && (
          <View style={[styles.resultBadge, result === "Scan Failed" && {backgroundColor: '#d9534f'}]}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.captureButton, loading && {opacity: 0.5}]} 
          onPress={handleScan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#007AFF" size="large" />
          ) : (
            <View style={styles.innerButton} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  msg: { color: 'white', textAlign: 'center', marginTop: 100, fontSize: 18 },
  overlay: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  resultBadge: {
    backgroundColor: '#28A745',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 40,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 10,
  },
  resultText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  innerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});