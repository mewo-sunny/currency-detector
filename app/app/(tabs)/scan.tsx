import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import * as Speech from 'expo-speech';
import { getCurrencyFromAPI } from '../../src/ml/onlineModel';
import { VoiceOverBadge } from '@/components/VoiceOverBadge';

export default function ScanScreen() {
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCameraInitialized, setIsCameraInitialized] = useState(false);

  const handleScan = async () => {
    if (camera.current == null || !isCameraInitialized) return;

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
        onInitialized={() => setIsCameraInitialized(true)}
      />

      <View style={styles.topContainer}>
        <VoiceOverBadge />
      </View>

      <View style={styles.overlay}>
        {result && (
          <View style={[styles.resultBadge, result === "Scan Failed" && { backgroundColor: '#d9534f' }]}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.captureButton, loading && { opacity: 0.5 }]}
          onPress={handleScan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#00E5FF" size="large" />
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
  topContainer: {
    position: 'absolute',
    top: 60,
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  resultBadge: {
    backgroundColor: 'rgba(18, 18, 18, 0.85)',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  resultText: {
    color: '#00E5FF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  innerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00E5FF',
  },
});