import { InferenceSession, Tensor } from "onnxruntime-react-native";
import { prepareModel } from "../services/modelInitializer";

let session: InferenceSession | null = null;

export async function loadOfflineModel(): Promise<void> {
  const modelPath = await prepareModel();
  session = await InferenceSession.create(modelPath);
}

export async function runOffline(inputArray: number[]) {
  if (!session) throw new Error("Model not loaded");

  const tensor = new Tensor(
    "float32",
    Float32Array.from(inputArray),
    [1, inputArray.length]
  );

  const results = await session.run({ input: tensor });
  return results.output.data;
}
