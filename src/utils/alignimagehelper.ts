//@ts-nocheck
// import { Tensor } from "onnxruntime-web";
import * as ort from "onnxruntime-web";
// import * as onnx from 'onnxjs';x/

async function keepAspectResizeAndPad(imagePath, resizeWidth, resizeHeight) {
  // Read the image using Jimp
  const image = await Jimp.read(imagePath);

  // Calculate aspect ratios
  const aspectHeight = resizeHeight / image.bitmap.height;
  const aspectWidth = resizeWidth / image.bitmap.width;

  // Choose the smaller aspect ratio
  const aspectMultiplier = Math.min(aspectWidth, aspectHeight);

  // Resize the image
  const resizedImage = await image.resize(
    image.bitmap.width * aspectMultiplier,
    image.bitmap.height * aspectMultiplier
  );
  // Create a new image with padding
  const paddedImage = new Jimp(resizeWidth, resizeHeight, 0x00000000); // Transparent background
  const startX = Math.floor((resizeWidth - resizedImage.bitmap.width) / 2);
  const startY = Math.floor((resizeHeight - resizedImage.bitmap.height) / 2);
  paddedImage.composite(resizedImage, startX, startY);

  return {
    paddedImage: paddedImage.bitmap.data,
    resizedImage: resizedImage.bitmap.data,
  };
}

export async function getImageTensorFromPath(
  canvasimage: string,
  imgwidth: number,
  imgheight: number,
  dims: number[] = [1, 3, 192, 192]
): Promise<Tensor> {
  const image = await loadImageFromPath(canvasimage, imgwidth, imgheight);

  return image;
}

async function loadImageFromPath(
  canvasimage: any,
  width: number,
  height: number
){
  const modelHeightAccept = 192;
  const modelWidthAccept = 192;

  let ash = modelHeightAccept / 480;
  let asw = modelWidthAccept / 640;
  let resizeHeight = 0;
  let resizeWidth = 0;
  let sizeAs = [];

  if (asw < ash) {
    resizeWidth = Math.floor(640 * asw);
    resizeHeight = Math.floor(480 * asw);
    sizeAs = [resizeWidth, resizeHeight];
  } else {
    resizeWidth = Math.floor(640 * ash);
    resizeHeight = Math.floor(480 * ash);
    sizeAs = [resizeWidth, resizeHeight];
  }
  const imagedata = new cv.imread(canvasimage);

  const resizedImage = new cv.Mat();
  cv.resize(
    imagedata,
    resizedImage,
    new cv.Size(resizeWidth,resizeHeight),
    0,
    0,
    cv.INTER_LINEAR
  );
  // const imageData = await Jimp.read(path).then((imageBuffer) => {
  //   return imageBuffer.resize(resizeWidth, resizeHeight);
  // });
const imageData=resizedImage.data

  const imageDataWithoutAlpha = [];

  for (let i = 0; i < imageData.length; i += 4) {
    imageDataWithoutAlpha.push(imageData[i + 2]);
    imageDataWithoutAlpha.push(imageData[i + 1]);
    imageDataWithoutAlpha.push(imageData[i]);
  }

  const flateended = imageDataWithoutAlpha.flat(Infinity);
  // downloadArrayAsTextFiles("crp.txt", flateended)

  const startH = Math.floor(modelHeightAccept / 2 - sizeAs[1] / 2);
  const endH = Math.floor(modelHeightAccept / 2 + sizeAs[1] / 2);
  const startW = Math.floor(modelWidthAccept / 2 - sizeAs[0] / 2);
  const endW = Math.floor(modelWidthAccept / 2 + sizeAs[0] / 2);

  const paddedImage1 = copyFlattenedArray(
    imageDataWithoutAlpha,
    startH,
    startW,
    sizeAs[0],
    sizeAs[1]
  );

  // downloadArrayAsTextFile(paddedImage1.flat(Infinity), "paddedImage")


  // const paddedImage2 = padImage(
  //   paddedImage1,
  //   modelHeightAccept,
  //   modelWidthAccept
  // );
  // // const flattenImage = paddedImage1.flat(2);

  // const flatted = flattenArray3D(paddedImage2);

  const padSizeHalfH = Math.max(
    0,
    Math.floor((modelHeightAccept - sizeAs[1]) / 2)
  );
  const padSizeHalfW = Math.max(
    0,
    Math.floor((modelWidthAccept - sizeAs[0]) / 2)
  );

  const padSizeScaleH = padSizeHalfH / modelHeightAccept;
  const padSizeScaleW = padSizeHalfW / modelWidthAccept;

  const paddedImageScaled = paddedImage1.map((row) =>
    row.map((pixel) => pixel.map((channel) => channel / 255.0))
  );
  
  const flateendedImagepadded = paddedImageScaled.flat(Infinity);

  const paddedImageReversed = convertRGBtoBGR(flateendedImagepadded);

  const flattenImage1 = paddedImageReversed.flat(Infinity);

  const paddedImageReversed3d = convertTo3DArray(paddedImageReversed);

  const swap = [2, 0, 1]; // Transpose channels

  const paddedImageTransposed = transposeArray(paddedImageReversed3d);

  const flattenImage = paddedImageTransposed.flat(Infinity);
  // downloadArrayAsTextFiles("crp.txt", flattenImage)

  const inputTensor = new ort.Tensor(
    "float32",
    new Float32Array(flattenImage),
    [1, 3, 192, 192]
  );

  return inputTensor;
}
function convertRGBtoBGR(flattenedImage) {
  const bgrImage = [];
  for (let i = 0; i < flattenedImage.length; i += 3) {
    bgrImage.push(flattenedImage[i + 2]); // Blue channel
    bgrImage.push(flattenedImage[i + 1]); // Green channel
    bgrImage.push(flattenedImage[i]); // Red channel
  }
  return bgrImage;
}
function padImage(source, targetHeight, targetWidth) {
  const paddedImage = new Array(targetHeight)
    .fill(null)
    .map(() => new Array(targetWidth).fill(null).map(() => [0, 0, 0]));

  let sourceIndex = 0;

  for (let h = 0; h < targetHeight; h++) {
    for (let w = 0; w < targetWidth; w++) {
      for (let c = 0; c < 3; c++) {
        paddedImage[h][w][c] = source[sourceIndex++];
      }
    }
  }

  return paddedImage;
}

function flattenArray3D(array3D) {
  const flattenedArray = [];
  for (let i = 0; i < array3D.length; i++) {
    for (let j = 0; j < array3D[i].length; j++) {
      for (let k = 0; k < array3D[i][j].length; k++) {
        flattenedArray.push(array3D[i][j][k]);
      }
    }
  }
  return flattenedArray;
}

function convertTo3DArray(paddedImageReversed: number[]): number[][][] {
  const result: number[][][] = [];
  const channels = 3;
  const width = 192;
  const height = 192;

  for (let i = 0; i < height; i++) {
    const row: number[][] = [];
    for (let j = 0; j < width; j++) {
      const pixel: number[] = [];
      for (let k = 0; k < channels; k++) {
        const index = (i * width + j) * channels + k;
        pixel.push(paddedImageReversed[index]);
      }
      row.push(pixel);
    }
    result.push(row);
  }

  return result;
}
import * as math from "mathjs";

function transposeArray(array) {
  const transposedArray = Array.from({ length: 3 }, () =>
    Array.from({ length: 192 }, () => Array(192).fill(0))
  );

  for (let i = 0; i < 192; i++) {
    const row = array[i];
    for (let j = 0; j < 192; j++) {
      transposedArray[0][i][j] = array[i][j][0];
      transposedArray[1][i][j] = array[i][j][1];
      transposedArray[2][i][j] = array[i][j][2];
    }
  }

  return transposedArray;
}


function swapChannels(pixel, swap) {
  return swap.map((index) => pixel[index]);
}

function convertToContiguousArray(paddedImage) {
  // Assuming paddedImage is a 3D array with shape (3, 192, 192)
  const channels = paddedImage.length;
  const height = paddedImage[0].length;
  const width = paddedImage[0][0].length;

  // Flatten the 3D array into a 1D TypedArray
  const flattenedArray = new Float32Array(channels * height * width);
  let index = 0;

  for (let c = 0; c < channels; c++) {
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        flattenedArray[index] = paddedImage[c][h][w];
        index++;
      }
    }
  }

  // Reshape the flattened array to match the shape (3, 192, 192)
  const reshapedArray = new Float32Array(
    flattenedArray.buffer,
    0,
    channels * height * width
  );
  reshapedArray.shape = [channels, height, width];

  return reshapedArray;
}



function copyFlattenedArray(resized_image, start_h, start_w, resizedWidth, resizedHeight) {
  const padded_image = new Array(192)
  .fill(null)
  .map(() => new Array(192).fill(null).map(() => [0, 0, 0]));

// Fill the padded_image with the resized_image data
for (let y = 0; y < resizedHeight; y++) {
  for (let x = 0; x < resizedWidth; x++) {
    // Calculate the index in the flattened array
    const index = (y * resizedWidth + x) * 3;
    // Calculate the destination positions
    const destY = start_h + y;
    const destX = start_w + x;
    // Check if the destination positions are within the bounds of the padded_image
    if (destY >= 0 && destY < 192 && destX >= 0 && destX < 192) {
      // Assign the RGB values
      padded_image[destY][destX][0] = resized_image[index];     // R
      padded_image[destY][destX][1] = resized_image[index + 1]; // G
      padded_image[destY][destX][2] = resized_image[index + 2]; // B
    }
  }
}

  return padded_image;
}
function imageDataToTensor(image: any, dims: number[]): Tensor {
  const imageBufferData = image;

  const [redArray, greenArray, blueArray] = [[], [], []];

  for (let i = 0; i < imageBufferData.length; i += 4) {
    redArray.push(imageBufferData[i] - 123);
    greenArray.push(imageBufferData[i + 1] - 117);
    blueArray.push(imageBufferData[i + 2] - 104);
  }

  const transposedData = blueArray.concat(greenArray).concat(redArray);
  const inputTensor = new Tensor("float32", transposedData, dims);
  return inputTensor;
}

async function preprocess(image, inputShapes, swap = [2, 0, 1]) {
  const inputH = inputShapes[0][2];
  const inputW = inputShapes[0][3];
  const [imageHeight, imageWidth] = [image.height, image.width];
  // Calculate padding
  const squareStandardSize = Math.max(imageHeight, imageWidth);
  const squarePaddingHalfSize = Math.abs(imageHeight - imageWidth) / 2;
  const { paddedImage, resizedImage } = await loadImageFromPath();


  const padSizeHalfH = Math.max(0, (inputH - resizedImage.height) / 2);
  const padSizeHalfW = Math.max(0, (inputW - resizedImage.width) / 2);

  const padSizeScaleH = padSizeHalfH / inputH;
  const padSizeScaleW = padSizeHalfW / inputW;

  // Normalize and transpose
  const imageData = new ImageData(resizedImage.width, resizedImage.height);
  const padCanvas = document.createElement("canvas");
  padCanvas.width = inputW;
  padCanvas.height = inputH;
  const padContext = padCanvas.getContext("2d");

  padContext.drawImage(resizedImage, padSizeHalfW, padSizeHalfH);
  imageData.data.set(padContext.getImageData(0, 0, inputW, inputH).data);

  const normalizedData = new Float32Array(imageData.data).map(
    (val) => val / 255
  );
  const normalizedImage = new ImageData(
    new Uint8ClampedArray(normalizedData.buffer),
    inputW,
    inputH
  );
  return normalizedImage;
}
export function downloadArrayAsTextFile(array, filename) {
  const data = array.join("\n");
  const blob = new Blob([data], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  window.URL.revokeObjectURL(url);

  document.body.removeChild(a);
}

export function downloadArrayAsTextFiles(filename: string, array: number[]) {
  const regularArray = Array.from(array); // Convert to a regular JavaScript array
  const data = regularArray.join("\n");
  const blob = new Blob([data], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  window.URL.revokeObjectURL(url);

  document.body.removeChild(a);
}
