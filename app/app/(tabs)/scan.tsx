import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, Platform } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Speech from 'expo-speech';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Note colors matched to actual RBI currency colours ──────────────────────
const NOTE_COLORS: Record<string, string> = {
  'Rs.10':   '#C97B2A', // warm chocolate brown
  'Rs.20':   '#B8A030', // yellow-ochre
  'Rs.50':   '#6B7FC4', // slate blue-purple
  'Rs.100':  '#9B7EB8', // lavender
  'Rs.200':  '#E8B830', // amber yellow
  'Rs.500':  '#8BAFC8', // stone grey-blue
  'rs1':     '#A8A8A8', // light silver (coin)
  'rs2':     '#B8A070', // bronze (coin)
  'rs5':     '#C8A000', // golden (coin)
  'rs10':    '#D4B840', // brass (coin)
  'rs20':    '#E0CC60', // pale gold (coin)
  'reverse': '#55AA77', // green fallback for reverse-side detections
};

function getNoteColor(label: string): string {
  return NOTE_COLORS[label] ?? '#FFFFFF';
}

interface Detection {
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
}

export default function App() {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);

  const [detections, setDetections] = useState<Detection[]>([]);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const lastSpoken = useRef('');

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }

    const interval = setInterval(() => {
      if (isCameraReady) {
        captureAndSend();
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [hasPermission, isCameraReady]);

  const captureAndSend = async () => {
    if (!camera.current || !hasPermission || !isCameraReady) return;

    try {
      const photo = await camera.current.takeSnapshot({ quality: 40 });
      const formData = new FormData();
      const fileUri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;

      formData.append('image', {
        uri: fileUri,
        type: 'image/jpeg',
        name: 'scan.jpg',
      } as any);

      const response = await fetch('http://192.168.1.38:5000/scan', {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const result = await response.json();

      if (result.status === 'success' && result.detections && result.detections.length > 0) {
        const { imgW, imgH } = result;

        const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
        const imageAspectRatio = imgH / imgW;

        let scale = 1;
        let offsetX = 0;
        let offsetY = 0;

        if (imageAspectRatio > screenAspectRatio) {
          scale = SCREEN_HEIGHT / imgH;
          offsetX = (SCREEN_WIDTH - imgW * scale) / 2;
        } else {
          scale = SCREEN_WIDTH / imgW;
          offsetY = (SCREEN_HEIGHT - imgH * scale) / 2;
        }

        const mapped: Detection[] = result.detections.map((d: any) => {
          const x1 = parseFloat(d.x1);
          const y1 = parseFloat(d.y1);
          const x2 = parseFloat(d.x2);
          const y2 = parseFloat(d.y2);

          return {
            label: d.label,
            left: x1 * scale + offsetX,
            top: y1 * scale + offsetY,
            width: (x2 - x1) * scale,
            height: (y2 - y1) * scale,
            color: getNoteColor(d.label),
          };
        });

        setDetections(mapped);

        const uniqueLabels = [...new Set(mapped.map((d) => d.label))];
        const speechText = uniqueLabels.join(' and ');

        if (speechText !== lastSpoken.current && speechText.length > 0) {
          await Speech.stop();
          Speech.speak(`Detected ${speechText}`, { rate: 0.9 });
          lastSpoken.current = speechText;
        }
      } else {
        setDetections([]);
        lastSpoken.current = '';
      }
    } catch (e) {
      console.log('Server connection failed.');
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Camera Permission Required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Searching for Camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        video={false}
        onInitialized={() => setIsCameraReady(true)}
        onError={() => setIsCameraReady(false)}
        resizeMode="contain"
      />

      {detections.map((d, index) => (
        <View
          key={`${d.label}-${index}`}
          style={[
            styles.boundingBox,
            {
              left: d.left,
              top: d.top,
              width: d.width,
              height: d.height,
              borderColor: d.color,
            },
          ]}
        >
          <View style={[styles.corner, styles.cornerTL, { borderColor: d.color }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: d.color }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: d.color }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: d.color }]} />

          <View style={[styles.labelContainer, { backgroundColor: d.color }]}>
            <Text style={styles.boxLabel}>{d.label}</Text>
          </View>
        </View>
      ))}

      <View style={styles.bottomBar}>
        {detections.length > 0 ? (
          <View style={styles.detectionRow}>
            {detections.map((d, i) => (
              <View key={i} style={[styles.badge, { backgroundColor: d.color }]}>
                <Text style={styles.badgeText}>{d.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.bottomText}>Scanning for Currency...</Text>
        )}
      </View>
    </View>
  );
}

const CORNER_SIZE = 18;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: { color: '#00FF00', fontSize: 18, fontWeight: 'bold' },
  boundingBox: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    borderRadius: 4,
    zIndex: 10,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: 'transparent',
    borderWidth: CORNER_THICKNESS,
  },
  cornerTL: {
    top: -CORNER_THICKNESS,
    left: -CORNER_THICKNESS,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: -CORNER_THICKNESS,
    right: -CORNER_THICKNESS,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: -CORNER_THICKNESS,
    left: -CORNER_THICKNESS,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: -CORNER_THICKNESS,
    right: -CORNER_THICKNESS,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 4,
  },
  labelContainer: {
    position: 'absolute',
    top: -26,
    left: -CORNER_THICKNESS,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  boxLabel: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: '80%',
    alignItems: 'center',
  },
  bottomText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  detectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});