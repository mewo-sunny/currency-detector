import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import * as Speech from 'expo-speech';
import { getCurrencyFromAPI } from '../../src/ml/onlineModel';

export default function RealTimeScanner() {
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  
  const [prediction, setPrediction] = useState('Align note in frame');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSpoken, setLastSpoken] = useState('');

  // 1. Request Permissions on Mount
  useEffect(() => {
    (async () => {
      await Camera.requestCameraPermission();
    })();
  }, []);

  // 2. The "Real-Time" Loop (Auto-Scan every 2 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (camera.current && !isProcessing) {
        handleCapture();
      }
    }, 2000); // 2000ms = 2 seconds

    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleCapture = async () => {
    try {
      setIsProcessing(true);
      
      // Capture a snapshot (silent, no flash)
      const photo = await camera.current!.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      // Send to your updated Flask API
      const result = await getCurrencyFromAPI(`file://${photo.path}`);

      if (result && result !== "Analyzing...") {
        setPrediction(result);
        
        // Only speak if the note has changed
        if (result !== lastSpoken) {
          Speech.speak(result);
          setLastSpoken(result);
        }
      }
    } catch (err) {
      console.error("Capture Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!device) return <View style={styles.centered}><Text>No Camera Found</Text></View>;

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true} // Enable photo capture
      />
      
      <View style={styles.overlay}>
        <Text style={styles.label}>AUTO-SCANNING</Text>
        <Text style={styles.text}>{prediction}</Text>
        {isProcessing && <ActivityIndicator color="#28A745" style={{ marginTop: 10 }} />}
      </View>

      {/* Visual Guide Box */}
      <View style={styles.guideBox} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { 
    position: 'absolute', 
    bottom: 80, 
    alignSelf: 'center', 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: '#28A745'
  },
  label: { color: '#28A745', fontSize: 12, fontWeight: 'bold', marginBottom: 5 },
  text: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  guideBox: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: '80%',
    height: '40%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 15,
    borderStyle: 'dashed'
  }
});