// @ts-nocheck

import * as ort from "onnxruntime-web";
import { downloadArrayAsTextFile } from "./alignimagehelper";
import inferencefile from "../../inference_imagejsjs.txt";
const cfg_mnet = {
  name: "mobilenet0.25",
  min_sizes: [
    [16, 32],
    [64, 128],
    [256, 512],
  ],
  steps: [8, 16, 32],
  variance: [0.1, 0.2],
  clip: false,
  loc_weight: 2.0,
  gpu_train: true,
  batch_size: 32,
  ngpu: 1,
  epoch: 250,
  decay1: 190,
  decay2: 220,
  image_size: 640,
  pretrain: true,
  return_layers: { stage1: 1, stage2: 2, stage3: 3 },
  in_channel: 32,
  out_channel: 64,
};

export async function runSqueezenetModel(
  preprocessedData: any,
  imgwidth: number,
  imgheight: number,
  session:any
): Promise<[any, number]> {
  // Create session and set options. See the docs here for more options:
  //https://onnxruntime.ai/docs/api/js/interfaces/InferenceSession.SessionOptions.html#graphOptimizationLevel

  // const session = await ort.InferenceSession.create(
  //   "./_next/static/chunks/palm_detection_full_inf_post_192x192.onnx",

  //   { executionProviders: ["wasm"], graphOptimizationLevel: "all" }
  // );
  // Run inference and get results.


  var [inferenceTime, boxes, outputData] = await runInference(
    session,
    preprocessedData
  );
  const postProcessResult = await post_process(
    inferenceTime,
    boxes,
    outputData
  );

  return [postProcessResult];
}

export async function runInference(
  session: ort.InferenceSession,
  preprocessedData: any
): Promise<[any, number]> {
  const start = new Date();
  const feeds: Record<string, ort.Tensor> = {};
  feeds["input"] = preprocessedData;

  const outputData = await session.run(feeds);

  const end = new Date();
  const inferenceTime = (end.getTime() - start.getTime()) / 1000;
  const boxes =
    outputData["pdscore_boxx_boxy_boxsize_kp0x_kp0y_kp2x_kp2y"].data;
  // downloadArrayAsTextFile(boxes,"boxes.txt")

  return [outputData, inferenceTime, boxes];
}

async function post_process(
  outputData: any,
  inferenceTime: number,
  boxes: any
) {
  const hands = [];
  const score_threshold = 0.6;
  let newArray = [];

  for (let i = 0; i < boxes.length; i++) {
    if (i % 8 === 0) {
      newArray.push([]);
    }
    newArray[Math.floor(i / 8)].push(boxes[i]);
  }


  let keep = newArray.map((box) => box[0] > score_threshold); // pd_score > this.score_threshold
  const filteredboxes = newArray.filter((box, index) => keep[index]);
  // const keep = newArray.map(box => box > score_threshold);
  // const filteredBoxes = newArray.filter((box, index) => keep[index]);

// downloadArrayAsTextFile(filteredboxes,"filteredboxes.txt")
  filteredboxes.forEach((box) => {
    const [pdScore, boxX, boxY, boxSize, kp0X, kp0Y, kp2X, kp2Y] = box;


    if (boxSize > 0) {
      let kp02X = kp2X - kp0X;
      let kp02Y = kp2Y - kp0Y;
      let sqnRrSize = 2.9 * boxSize;
      let rotation = 0.5 * Math.PI - Math.atan2(-kp02Y, kp02X);
      // rotation = normalizeRadians(rotation);
      let sqnRrCenterX = boxX + 0.5 * boxSize * Math.sin(rotation);
      let sqnRrCenterY = boxY - 0.5 * boxSize * Math.cos(rotation);
      sqnRrCenterY = (sqnRrCenterY * 640 - 80) / 480;

      hands.push([sqnRrSize, rotation, sqnRrCenterX, sqnRrCenterY]);
    }
  });


  return hands;
}

