//@ts-nocheck
import * as ort from "onnxruntime-web";
import {
  downloadArrayAsTextFile,
  downloadArrayAsTextFiles,
} from "./alignimagehelper";

export async function handlelandmark(images, rects,session) {
  const [
    inference_images,
    resized_images,
    resize_scales_224x224,
    half_pad_sizes_224x224,
  ] = preprocess(images);
  // downloadArrayAsTextFiles("inference_images.txt", inference_images[0].data)

  let [xyz_x21s, hand_scores, left_hand_0_or_right_hand_1s] =
    await runSqueezenetModel(inference_images,session);
    // downloadArrayAsTextFiles("xyz_x21s.txt", xyz_x21s.data)
  const [hand_landmarks, rotated_image_size_leftrights] = postprocess(
    resized_images,
    resize_scales_224x224,
    half_pad_sizes_224x224,
    rects,
    xyz_x21s,
    hand_scores,
    left_hand_0_or_right_hand_1s
  );


  return [hand_landmarks, rotated_image_size_leftrights];
}

function preprocess(images) {
  const inputH = 224;
  const inputW = 224;

  const paddedImages = [];
  const resizedImages = [];
  const resizeScales224x224 = [];
  const halfPadSizes224x224 = [];

  images.forEach((image) => {
    let { paddedImage, resizedImage } = keepAspectResizeAndPad(
      images,
      inputW,
      inputH
    );
    const resize224x224ScaleH = resizedImage.cols / image.cols;
    const resize224x224ScaleW = resizedImage.rows / image.rows;
    resizeScales224x224.push([resize224x224ScaleW, resize224x224ScaleH]);

    const padH = paddedImage.cols - resizedImage.cols;
    const padW = paddedImage.rows - resizedImage.rows;
    const halfPadH224x224 = Math.floor(padH / 2);
    const halfPadW224x224 = Math.floor(padW / 2);
    halfPadSizes224x224.push([halfPadH224x224, halfPadW224x224, ]);
    console.log(paddedImage, "paddedImage")
    paddedImage.convertTo(paddedImage, cv.CV_32FC3, 1 / 255.0);

    // Step 2: Reverse the order of the third dimension (BGR to RGB)
    cv.cvtColor(paddedImage, paddedImage, cv.COLOR_BGR2RGB);

    // Step 3: Transpose the matrix (swap rows and columns)
    // const transposeImage = new cv.Mat();
    // cv.transpose(paddedImage, transposeImage);
    const transposeImage = transposedArrays(paddedImage.data32F);
    paddedImage.delete();
    // Step 4: Convert the matrix to a Float32Array
    const flatArray = new Float32Array(transposeImage);

    // downloadArrayAsTextFiles("asad.txt", flatArray);
    const inputTensor = new ort.Tensor(
      "float32",
      new Float32Array(flatArray),
      [1, 3, 224, 224]
    );
    paddedImages.push(inputTensor);
    resizedImages.push(resizedImage);
  });

  return [
    paddedImages,
    resizedImages,
    new Float32Array(resizeScales224x224.flat()),
    new Int32Array(halfPadSizes224x224.flat()),
  ];
}

function transposedArrays(inputArray) {
  // Ensure the inputArray is of the correct shape (224, 224, 3)
  if (inputArray.length !== 224 * 224 * 3) {
    throw new Error("Input array shape does not match (224, 224, 3)");
  }

  // Initialize the transposed array
  const transposedArrays = [];

  // Perform the transpose operation
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 224 * 224; j++) {
      transposedArrays.push(inputArray[j * 3 + i]);
    }
  }

  return transposedArrays;
}

function keepAspectResizeAndPad(image, resizeWidth, resizeHeight) {
  const imageHeight = image[0].rows; // Corrected rows and cols
  const imageWidth = image[0].cols; // Corrected rows and cols

  let paddedImage = new cv.Mat.zeros(resizeHeight, resizeWidth, cv.CV_8UC3);

  const ash = resizeHeight / imageHeight;
  const asw = resizeWidth / imageWidth;

  let sizeas;
  if (asw < ash) {
    sizeas = new cv.Size(imageWidth * asw, imageHeight * asw);
  } else {
    sizeas = new cv.Size(imageWidth * ash, imageHeight * ash);
  }

  const resizedImage = new cv.Mat();
  cv.resize(image[0], resizedImage, sizeas, 0, 0, cv.INTER_LINEAR);
  // downloadArrayAsTextFiles("reszed.txt", resizedImage.data);
  const startH = Math.floor(resizeHeight / 2 - sizeas.height / 2);
  const endH = Math.floor(resizeHeight / 2 + sizeas.height / 2);
  const startW = Math.floor(resizeWidth / 2 - sizeas.width / 2);
  const endW = Math.floor(resizeWidth / 2 + sizeas.width / 2);

  for (let i = startH; i < endH && i < paddedImage.rows; i++) {
    for (let j = startW; j < endW && j < paddedImage.cols; j++) {
      const pixel = resizedImage.ucharPtr(i - startH, j - startW);
      paddedImage.ucharPtr(i, j).set(pixel);
    }
  }

  return { paddedImage, resizedImage };
}

async function runSqueezenetModel(
  preprocessedData: any,
  session: any,
  imgwidth: number,
  imgheight: number,
): Promise<[any, number]> {
  // const session = await ort.InferenceSession.create(
  //   "./_next/static/chunks/hand_landmark_sparse_N.onnx",

  //   { executionProviders: ["wasm"], graphOptimizationLevel: "all" }
  // );
  // Run inference and get results.

  // downloadArrayAsTextFiles("mia.txt", preprocessedData[0].data)

  var [xyz_x21s, hand_scores, left_hand_0_or_right_hand_1s] =
    await runInference(session, preprocessedData);

  return [xyz_x21s, hand_scores, left_hand_0_or_right_hand_1s];
}

export async function runInference(
  session: ort.InferenceSession,
  preprocessedData: any
): Promise<[any, number]> {
  const start = new Date();
  const feeds: Record<string, ort.Tensor> = {};
  feeds["input"] = preprocessedData[0];
  const outputData = await session.run(feeds);

  const xyz_x21s = outputData["xyz_x21"];
  const hand_score = outputData["hand_score"];
  const lefthand_0_or_righthand_1 = outputData["lefthand_0_or_righthand_1"];

  const end = new Date();
  const inferenceTime = (end.getTime() - start.getTime()) / 1000;

  return [xyz_x21s, hand_score, lefthand_0_or_righthand_1];
}

function postprocess(
  resizedImages,
  resizeScales224x224,
  halfPadSizes224x224,
  rects,
  xyz_x21s,
  handScores,
  leftHand_0_or_rightHand_1s,
  class_score_th = 0.5
) {
  let hand_landmarks = [];
  let extracted_hands = [];
  let rotated_image_size_leftrights = [];

  let flatten_resizedImages = resizedImages[0].data;

  let xyz_x21DataArray = Array.from(xyz_x21s.data);
  let leftHand_0_or_rightHand_1s_flat = Array.from(
    leftHand_0_or_rightHand_1s.data
  );

  for (let i = 0; i < resizedImages.length; i++) {
    let resizedImage = flatten_resizedImages;
    let resizeScale224x224 = resizeScales224x224;
    let halfPadSize224x224 = halfPadSizes224x224;
    let rect = rects;
    let xyz_x21 = xyz_x21DataArray;
    let leftHand_0_or_rightHand_1 = leftHand_0_or_rightHand_1s_flat;

    let rrnLms = xyz_x21;
    let inputH = 224;
    let inputW = 224;
    rrnLms = rrnLms.map((v) => v / inputH);
    // downloadArrayAsTextFiles("rrnLms", rrnLms)
    let rcx = rect[0];
    let rcy = rect[1];
    let angle = rect[4];
    let viewImage = new cv.Mat();
    cv.resize(
      resizedImages[0],
      viewImage,
      new cv.Size(),
      1 / resizeScale224x224[0],
      1 / resizeScale224x224[1],
      cv.INTER_LINEAR
    );
    let rescaled_xy = rrnLms.reduce((acc, _, i) => {
      if (i % 3 === 0) {
        acc.push([rrnLms[i], rrnLms[i + 1]]);
      }
      return acc;
    }, []);

    
    // Convert rescaled_xy to np.float32
    rescaled_xy = rescaled_xy.map((v) => [parseFloat(v[0]), parseFloat(v[1])]);
    // Perform the rescaling operations
    rescaled_xy.forEach((v) => {
      v[0] = (v[0] * inputW - halfPadSizes224x224[0]) / resizeScale224x224[0];
      v[1] = (v[1] * inputH - halfPadSizes224x224[1]) / resizeScale224x224[1];
    });
    // downloadArrayAsTextFiles("rescaled_xy", rescaled_xy.flat(Infinity))

    // Convert rescaled_xy to np.int32
    rescaled_xy = rescaled_xy.map((v) => [parseInt(v[0]), parseInt(v[1])]);
    // downloadArrayAsTextFiles("rescaled_xy", rescaled_xy.flat(Infinity))

    // Print or use the resulting rescaled_xy array
    let imageCenter = new cv.Point(viewImage.cols / 2, viewImage.rows / 2);
    let rotationMatrix = cv.getRotationMatrix2D(
      imageCenter,
      -Math.trunc(angle),
      1
    );
    let abs_cos = Math.abs(rotationMatrix.data64F[0]);
    let abs_sin = Math.abs(rotationMatrix.data64F[1]);
    let bound_w = parseInt(viewImage.rows * abs_sin + viewImage.cols * abs_cos);
    let bound_h = parseInt(viewImage.rows * abs_cos + viewImage.cols * abs_sin);
    rotationMatrix.data64F[2] += bound_w / 2 - imageCenter.x; // Adjusting the x translation
    rotationMatrix.data64F[5] += bound_h / 2 - imageCenter.y;
    let rotatedImage = new cv.Mat();
    cv.warpAffine(
      viewImage,
      rotatedImage,
      rotationMatrix,
      new cv.Size(bound_w, bound_h)
    );
    viewImage.delete();
    // downloadArrayAsTextFiles("rotated.text", rotatedImage.data)
    let keypoints = [];
    for (let i = 0; i < rescaled_xy.length; i++) {
      let x = rescaled_xy[i][0];
      let y = rescaled_xy[i][1];
      let coord_arr = [
        [x, y, 1], // Left-Top
      ];

      let rotation_matrix_flat = Array.from(rotationMatrix.data64F);
      let rotation_matrix = [
        rotation_matrix_flat.slice(0, 3),
        rotation_matrix_flat.slice(3, 6),
      ];

      let transpose_coord_arr = transposeMatrix(coord_arr);
      let new_coord = matrixMultiply(rotation_matrix, transpose_coord_arr);
      let x_ls = new_coord[0];
      let y_ls = new_coord[1];
      keypoints.push([Math.trunc(x_ls), Math.trunc(y_ls)]);
    }


    let rotatedImageWidth = rotatedImage.cols;
    let rotatedImageHeight = rotatedImage.rows;
    let rotatedHandHalfWidth = Math.floor(rotatedImageWidth / 2);
    let rotatedHandHalfHeight = Math.floor(rotatedImageHeight / 2);
    
    keypoints.forEach(([x, y], index) => {
      rescaled_xy[index][0] = x + rcx - rotatedHandHalfWidth;
      rescaled_xy[index][1] = y + rcy - rotatedHandHalfHeight;
    });
    hand_landmarks = convertCoordinates(keypoints, rcx, rcy, rotatedHandHalfWidth, rotatedHandHalfHeight);
    extracted_hands.push(hand_landmarks);
    rotated_image_size_leftrights.push([
      rotatedImageWidth,
      rotatedImageHeight,
      leftHand_0_or_rightHand_1[0],
    ]);
  }

  return [extracted_hands, rotated_image_size_leftrights];
}
function transposeMatrix(matrix) {
  return matrix[0].map((col, i) => matrix.map((row) => row[i]));
}

function matrixMultiply(a, b) {
  let result = [];
  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < b.length; k++) { // changed from a[0].length to b.length
        sum += a[i][k] * b[k][j]; // changed from a[i * a[0].length + k] to a[i][k]
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function convertCoordinates(keypoints, rcx, rcy, roatated_hand_half_width, roatated_hand_half_height) {
  let handLandmarks = [];

  for (let i = 0; i < keypoints.length; i++) {
      let x = keypoints[i][0] + rcx - roatated_hand_half_width;
      let y = keypoints[i][1] + rcy - roatated_hand_half_height;
      handLandmarks.push([x, y]);
  }

  return handLandmarks;
}