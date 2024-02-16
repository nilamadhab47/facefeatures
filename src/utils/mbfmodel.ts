//@ts-nocheck
import * as Jimp from "jimp";
import * as ort from "onnxruntime-web";

export async function getImageTensorFromPath(
  path: string,
  dims: number[] = [1, 3, 112, 112]
): Promise<Float32Array> {
  const image = await loadImageFromPath(path, 112, 112);
  const imageTensor = imageDataToTensor(image.bitmap.data, dims);
  const outputData = await runSqueezenetModel(imageTensor);
  return outputData[0]["553"].data;
}

async function loadImageFromPath(
  path: string,
  width: number = 112,
  height: number = 112
): Promise<Jimp> {
  const imageData = await Jimp.read(path).then((imageBuffer) =>
    imageBuffer.resize(width, height)
  );
  return imageData;
}

function imageDataToTensor(image: any, dims: number[]): ort.Tensor {
  const imageBufferData = image;
  const [redArray, greenArray, blueArray] = [[], [], []];

  for (let i = 0; i < imageBufferData.length; i += 4) {
    redArray.push(imageBufferData[i]);
    greenArray.push(imageBufferData[i + 1]);
    blueArray.push(imageBufferData[i + 2]);
  }




  const transposedData = blueArray.concat(greenArray, redArray);

  const float32Data = transposedData.map(
    (value) => ((value / 255.0) - 0.5) / 0.5
  );

  return new ort.Tensor("float32", new Float32Array(float32Data), dims);
}

async function runSqueezenetModel(
  preprocessedData: ort.Tensor
): Promise<[any, number]> {
  const session = await ort.InferenceSession.create(
    "./_next/static/chunks/sabuj-mbf.onnx",
    { executionProviders: ["wasm"], graphOptimizationLevel: "all" }
  );

  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = preprocessedData;

  const outputData = await session.run(feeds);
  return [outputData];
}
