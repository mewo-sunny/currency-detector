import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, Dimensions, Platform } from "react-native";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import * as Speech from "expo-speech";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SERVER_URL = "http://10.226.21.76:5000/scan";

const NOTE_COLORS = {
  "Rs.10": "#C97B2A",
  "Rs.20": "#B8A030",
  "Rs.50": "#6B7FC4",
  "Rs.100": "#9B7EB8",
  "Rs.200": "#E8B830",
  "Rs.500": "#8BAFC8",
};

function getNoteColor(label) {
  return NOTE_COLORS[label] || "#00FF00";
}

export default function App() {

  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef(null);
  const scanning = useRef(false);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [detections, setDetections] = useState([]);
  const lastSpoken = useRef("");

  useEffect(() => {
    const init = async () => {
      if (!hasPermission) {
        console.log("Requesting camera permission...");
        await requestPermission();
      }
    };
    init();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isCameraReady && !scanning.current) {
        captureAndSend();
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isCameraReady]);

  const captureAndSend = async () => {
    if (!camera.current || !isCameraReady) return;

    scanning.current = true;

    try {
      console.log("Taking photo...");

      const photo = await camera.current.takePhoto({
        qualityPrioritization: "speed",
        flash: "off",
      });

      const formData = new FormData();
      const uri = Platform.OS === "android" ? `file://${photo.path}` : photo.path;

      formData.append("image", {
        uri: uri,
        type: "image/jpeg",
        name: "scan.jpg",
      });

      console.log("Sending to server...");
      const response = await fetch(SERVER_URL, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      const result = await response.json();
      console.log("Server response:", result);

      if (result.status === "success" && result.detections?.length > 0) {

        const { imgW, imgH } = result;
        const scaleX = SCREEN_WIDTH / imgW;
        const scaleY = SCREEN_HEIGHT / imgH;

        const mapped = result.detections.map((d) => {
          const x1 = parseFloat(d.x1);
          const y1 = parseFloat(d.y1);
          const x2 = parseFloat(d.x2);
          const y2 = parseFloat(d.y2);

          return {
            label: d.label,
            left: x1 * scaleX,
            top: y1 * scaleY,
            width: (x2 - x1) * scaleX,
            height: (y2 - y1) * scaleY,
            color: getNoteColor(d.label),
          };
        });

        setDetections(mapped);

        const labels = [...new Set(mapped.map((d) => d.label))];
        const speech = labels.join(" and ");

        if (speech !== lastSpoken.current) {
          await Speech.stop();
          Speech.speak("Detected " + speech);
          lastSpoken.current = speech;
        }

      } else {
        setDetections([]);
      }

    } catch (error) {
      console.log("SCAN ERROR:", error);
    } finally {
      scanning.current = false;
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Camera permission required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Loading camera...</Text>
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
        onInitialized={() => {
          console.log("Camera initialized");
          setIsCameraReady(true);
        }}
      />

      {detections.map((d, i) => (
        <View
          key={i}
          style={[
            styles.box,
            { left: d.left, top: d.top, width: d.width, height: d.height, borderColor: d.color },
          ]}
        >
          <Text style={[styles.label, { backgroundColor: d.color }]}>{d.label}</Text>
        </View>
      ))}

      <View style={styles.bottom}>
        {detections.length === 0 ? (
          <Text style={styles.bottomText}>Scanning currency...</Text>
        ) : (
          detections.map((d, i) => (
            <Text key={i} style={styles.bottomText}>
              {d.label}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { color: "#fff", fontSize: 18 },
  box: { position: "absolute", borderWidth: 3 },
  label: { position: "absolute", top: -24, color: "#000", paddingHorizontal: 6, paddingVertical: 2, fontWeight: "bold" },
  bottom: { position: "absolute", bottom: 50, alignSelf: "center" },
  bottomText: { color: "#fff", fontSize: 18 },
});