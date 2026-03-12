import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Model config ─────────────────────────────────────────────────────────────
const MODEL_INPUT_SIZE   = 640;
const CONF_THRESHOLD     = 0.50; // lowered for debugging — raise back to 0.90 once working
const IOU_THRESHOLD      = 0.4;
const MAX_BOX_AREA_RATIO = 0.85;
const SCAN_INTERVAL_MS   = 1200;  // same as original Flask version
const BUFFER_DURATION_MS = 1500;  // same as original Flask version

// ─── Class labels — must match model's names order exactly ───────────────────
// Verify with: python -c "from ultralytics import YOLO; m=YOLO('last.pt'); print(m.names)"
const CLASS_LABELS: string[] = [
  'Rs.10', 'Rs.20', 'Rs.50', 'Rs.100', 'Rs.200', 'Rs.500',
  'rs1', 'rs2', 'rs5', 'rs10', 'rs20', 'reverse',
];

// ─── Note colors ──────────────────────────────────────────────────────────────
const NOTE_COLORS: Record<string, string> = {
  'Rs.10':   '#C97B2A',
  'Rs.20':   '#B8A030',
  'Rs.50':   '#6B7FC4',
  'Rs.100':  '#9B7EB8',
  'Rs.200':  '#E8B830',
  'Rs.500':  '#8BAFC8',
  'rs1':     '#A8A8A8',
  'rs2':     '#B8A070',
  'rs5':     '#C8A000',
  'rs10':    '#D4B840',
  'rs20':    '#E0CC60',
  'reverse': '#55AA77',
};

function getNoteColor(label: string): string {
  return NOTE_COLORS[label] ?? '#FFFFFF';
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface RawDetection {
  label: string;
  confidence: number;
  x1: number; y1: number;
  x2: number; y2: number;
}

interface Detection extends RawDetection {
  left: number; top: number;
  width: number; height: number;
  color: string;
}

// ─── IoU ──────────────────────────────────────────────────────────────────────
function iou(a: RawDetection, b: RawDetection): number {
  const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
  const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const aArea = (a.x2 - a.x1) * (a.y2 - a.y1);
  const bArea = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (aArea + bArea - inter + 1e-6);
}

// ─── Agnostic NMS ─────────────────────────────────────────────────────────────
function applyNMS(detections: RawDetection[], iouThreshold: number): RawDetection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: RawDetection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (!suppressed.has(j) && iou(sorted[i], sorted[j]) > iouThreshold)
        suppressed.add(j);
    }
  }
  return kept;
}

// ─── Parse YOLOv8 TFLite output ──────────────────────────────────────────────
// onnx2tf exports as [1, 8400, 16] (row-major) NOT [1, 16, 8400]
// We detect which layout by checking if first 4 values look like valid coords
function parseYoloOutput(
  output: Float32Array,
  numClasses: number,
  confThreshold: number,
  maxBoxAreaRatio: number,
): RawDetection[] {
  const numBoxes = 8400;
  const stride   = 4 + numClasses; // 16
  const detections: RawDetection[] = [];

  // Detect layout: [8400, 16] row-major vs [16, 8400] col-major
  // In row-major [8400,16]: output[0..3] = cx,cy,w,h of box 0 (normalized ~0-1)
  // In col-major [16,8400]: output[0] = cx of box 0, output[8400] = cy of box 0
  // Heuristic: if output[0] is between 0-1 and output[1] is between 0-1 -> row-major
  const isRowMajor = output[0] >= 0 && output[0] <= 1 && output[1] >= 0 && output[1] <= 1;
  console.log('Layout:', isRowMajor ? '[8400,16] row-major' : '[16,8400] col-major', '| output[0..3]:', output[0].toFixed(3), output[1].toFixed(3), output[2].toFixed(3), output[3].toFixed(3));

  for (let i = 0; i < numBoxes; i++) {
    let cx: number, cy: number, bw: number, bh: number, maxScore: number, classIdx: number;

    if (isRowMajor) {
      // [8400, 16]: each row is one box: [cx, cy, w, h, c0, c1, ...]
      const base = i * stride;
      cx = output[base + 0];
      cy = output[base + 1];
      bw = output[base + 2];
      bh = output[base + 3];
      maxScore = 0; classIdx = 0;
      for (let c = 0; c < numClasses; c++) {
        const score = output[base + 4 + c];
        if (score > maxScore) { maxScore = score; classIdx = c; }
      }
    } else {
      // [16, 8400]: each column is one box
      cx = output[0 * numBoxes + i];
      cy = output[1 * numBoxes + i];
      bw = output[2 * numBoxes + i];
      bh = output[3 * numBoxes + i];
      maxScore = 0; classIdx = 0;
      for (let c = 0; c < numClasses; c++) {
        const score = output[(4 + c) * numBoxes + i];
        if (score > maxScore) { maxScore = score; classIdx = c; }
      }
    }

    if (maxScore < confThreshold) continue;

    // Normalized [0,1] centre → pixel coords at MODEL_INPUT_SIZE scale
    const x1 = (cx - bw / 2) * MODEL_INPUT_SIZE;
    const y1 = (cy - bh / 2) * MODEL_INPUT_SIZE;
    const x2 = (cx + bw / 2) * MODEL_INPUT_SIZE;
    const y2 = (cy + bh / 2) * MODEL_INPUT_SIZE;

    const boxArea = (x2 - x1) * (y2 - y1);
    if (boxArea / (MODEL_INPUT_SIZE * MODEL_INPUT_SIZE) > maxBoxAreaRatio) continue;

    detections.push({
      label: CLASS_LABELS[classIdx] ?? 'unknown',
      confidence: maxScore,
      x1, y1, x2, y2,
    });
  }

  return applyNMS(detections, IOU_THRESHOLD);
}

// ─── Map model coords (640x640) → screen coords ───────────────────────────────
function mapToScreen(raw: RawDetection[], imgW: number, imgH: number): Detection[] {
  const screenAspect = SCREEN_HEIGHT / SCREEN_WIDTH;
  const imageAspect  = imgH / imgW;
  let scale = 1, offsetX = 0, offsetY = 0;

  if (imageAspect > screenAspect) {
    scale   = SCREEN_HEIGHT / imgH;
    offsetX = (SCREEN_WIDTH - imgW * scale) / 2;
  } else {
    scale   = SCREEN_WIDTH / imgW;
    offsetY = (SCREEN_HEIGHT - imgH * scale) / 2;
  }

  return raw.map((d) => ({
    ...d,
    left:   d.x1 * scale + offsetX,
    top:    d.y1 * scale + offsetY,
    width:  (d.x2 - d.x1) * scale,
    height: (d.y2 - d.y1) * scale,
    color:  getNoteColor(d.label),
  }));
}

// ─── Spatial-temporal smoothing buffer (identical to app.py) ──────────────────
interface BufferEntry { data: RawDetection; timestamp: number; }
const detectionBuffer = new Map<string, BufferEntry>();

function updateBuffer(current: RawDetection[]): RawDetection[] {
  const now = Date.now();
  for (const d of current) {
    const cx  = Math.floor(((d.x1 + d.x2) / 2) / 50);
    const cy  = Math.floor(((d.y1 + d.y2) / 2) / 50);
    const key = `${d.label}_${cx}_${cy}`;
    detectionBuffer.set(key, { data: d, timestamp: now });
  }
  for (const [key, entry] of detectionBuffer.entries()) {
    if (now - entry.timestamp > BUFFER_DURATION_MS) detectionBuffer.delete(key);
  }
  return Array.from(detectionBuffer.values()).map((e) => e.data);
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function buildSpeechText(labels: string[]): string {
  if (labels.length === 0) return '';
  const counts: Record<string, number> = {};
  for (const l of labels) counts[l] = (counts[l] ?? 0) + 1;
  const parts = Object.entries(counts).map(([label, count]) =>
    count > 1 ? `${count} ${label}` : label
  );
  return `Detected ${parts.join(' and ')}`;
}

// ─── Pulse badge ──────────────────────────────────────────────────────────────
function PulseBadge({ label, color }: { label: string; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.badge, { backgroundColor: color, transform: [{ scale }] }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);

  const model = useTensorflowModel(require('../../assets/models/last_float32.tflite'));

  const [detections, setDetections]     = useState<Detection[]>([]);
  const lastSpokenRef   = useRef('');
  const isProcessingRef = useRef(false); // prevent overlapping runs

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  // ── Snapshot → resize → TFLite → render (mirrors original Flask flow) ───────
  const captureAndInfer = useCallback(async () => {
    if (!camera.current || !hasPermission || model.state !== 'loaded' || isProcessingRef.current) return;

    isProcessingRef.current = true;
    let fileUri = '';

    try {
      // 1. Snapshot (quality 40 = fast, mirrors Flask approach)
      console.log('📸 Taking photo...');
      const photo = await camera.current.takePhoto({ qualityPrioritization: 'speed' });
      console.log('📸 Photo taken:', photo.path, photo.width, 'x', photo.height);
      fileUri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;

      // 2. Resize to 640×640 (what YOLO expects)
      const resized = await ImageManipulator.manipulateAsync(
        fileUri,
        [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
        { format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!resized.base64) return;

      if (!resized.base64) return;

      // 3. Decode JPEG base64 → raw RGBA pixels using jpeg-js
      //    then convert RGBA → float32 RGB normalized [0, 1]
      //    Model expects: float32 NHWC [1, 640, 640, 3]
      const jpegBinary = atob(resized.base64);
      const jpegBytes  = new Uint8Array(jpegBinary.length);
      for (let i = 0; i < jpegBinary.length; i++) jpegBytes[i] = jpegBinary.charCodeAt(i);

      // jpeg-js decodes to { data: Uint8Array (RGBA), width, height }
      const decoded = jpeg.decode(jpegBytes, { useTArray: true });

      // RGBA → float32 RGB [0,1] — matches model input shape [1, 640, 640, 3]
      const numPixels   = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
      const float32Input = new Float32Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        float32Input[i * 3 + 0] = decoded.data[i * 4 + 0] / 255.0; // R
        float32Input[i * 3 + 1] = decoded.data[i * 4 + 1] / 255.0; // G
        float32Input[i * 3 + 2] = decoded.data[i * 4 + 2] / 255.0; // B
        // skip alpha channel [i * 4 + 3]
      }

      // 4. Run inference
      const outputs   = model.model.runSync([float32Input]);
      const rawOutput = outputs[0] as Float32Array;

      // 5. Parse + NMS
      let globalMax = 0;
      for (let k = 0; k < rawOutput.length; k++) if (rawOutput[k] > globalMax) globalMax = rawOutput[k];
      console.log('🧠 Output len:', rawOutput.length, '| maxConf:', globalMax.toFixed(4), '| decoded pixels:', decoded.width, 'x', decoded.height);

      const raw = parseYoloOutput(
        rawOutput,
        CLASS_LABELS.length,
        CONF_THRESHOLD,
        MAX_BOX_AREA_RATIO,
      );
      console.log('🎯 Detections:', raw.length, raw.map(d => d.label + '(' + (d.confidence*100).toFixed(0) + '%)').join(', ') || 'none');

      // 6. Buffer smoothing → screen coords
      const smoothed = updateBuffer(raw);

      if (smoothed.length > 0) {
        const mapped = mapToScreen(smoothed, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
        setDetections(mapped);

        const speechText = buildSpeechText(smoothed.map((d) => d.label));
        if (speechText !== lastSpokenRef.current) {
          await Speech.stop();
          Speech.speak(speechText, { rate: 0.9 });
          lastSpokenRef.current = speechText;
        }
      } else {
        setDetections([]);
        lastSpokenRef.current = '';
      }

    } catch (e) {
      console.log('Inference error:', e);
    } finally {
      // Clean up snapshot file
      if (fileUri) {
        FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
      }
      isProcessingRef.current = false;
    }
  }, [hasPermission, isCameraReady, model.state, model.model]);

  useEffect(() => {
    const interval = setInterval(captureAndInfer, SCAN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [captureAndInfer]);

  // ── Render guards ──────────────────────────────────────────────────────────
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
        <Text style={styles.errorText}>Searching for Camera…</Text>
      </View>
    );
  }

  const isLoading = model.state === 'loading';

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        video={false}
        resizeMode="contain"
      />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading model…</Text>
        </View>
      )}

      {/* Bounding boxes */}
      {detections.map((d, index) => (
        <View
          key={`${d.label}-${index}`}
          style={[styles.boundingBox, {
            left: d.left, top: d.top,
            width: d.width, height: d.height,
            borderColor: d.color,
          }]}
        >
          <View style={[styles.corner, styles.cornerTL, { borderColor: d.color }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: d.color }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: d.color }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: d.color }]} />
          <View style={[styles.labelContainer, { backgroundColor: d.color }]}>
            <Text style={styles.boxLabel}>{d.label}</Text>
            <Text style={styles.boxConf}>{Math.round(d.confidence * 100)}%</Text>
          </View>
        </View>
      ))}

      {/* Bottom HUD */}
      <View style={styles.bottomBar}>
        {detections.length > 0 ? (
          <>
            <Text style={styles.totalText}>
              {detections.length} item{detections.length > 1 ? 's' : ''} detected
            </Text>
            <View style={styles.detectionRow}>
              {detections.map((d, i) => (
                <PulseBadge key={`badge-${i}`} label={d.label} color={d.color} />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.bottomText}>
            {isLoading ? 'Loading model…' : 'Scanning for currency…'}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CORNER_SIZE      = 18;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  errorText: { color: '#00FF00', fontSize: 18, fontWeight: 'bold' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  loadingText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },

  boundingBox: {
    position: 'absolute', borderWidth: 1.5,
    backgroundColor: 'transparent', borderRadius: 4, zIndex: 10,
  },
  corner: {
    position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: 'transparent', borderWidth: CORNER_THICKNESS,
  },
  cornerTL: { top: -CORNER_THICKNESS,    left: -CORNER_THICKNESS,  borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: -CORNER_THICKNESS,    right: -CORNER_THICKNESS, borderBottomWidth: 0, borderLeftWidth: 0,  borderTopRightRadius: 4 },
  cornerBL: { bottom: -CORNER_THICKNESS, left: -CORNER_THICKNESS,  borderTopWidth: 0,    borderRightWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: -CORNER_THICKNESS, right: -CORNER_THICKNESS, borderTopWidth: 0,    borderLeftWidth: 0,  borderBottomRightRadius: 4 },

  labelContainer: {
    position: 'absolute', top: -30, left: -CORNER_THICKNESS,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  boxLabel: { color: '#000', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  boxConf:  { color: 'rgba(0,0,0,0.65)', fontSize: 10, fontWeight: '600' },

  bottomBar: {
    position: 'absolute', bottom: 50, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 30, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: '80%', alignItems: 'center', gap: 8,
  },
  totalText: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12,
    fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase',
  },
  bottomText: {
    color: 'rgba(255,255,255,0.6)', fontSize: 16,
    fontWeight: '600', textAlign: 'center', letterSpacing: 0.5,
  },
  detectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  badgeText:    { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});