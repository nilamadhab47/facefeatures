//@ts-nocheck

import { Console } from "console";
import {
  downloadArrayAsTextFile,
  downloadArrayAsTextFiles,
} from "./alignimagehelper";
import { array } from "ndarray";
//cropped_and_rotated_image_functions

export function rotate_and_crop_rectangle(
  image,
  rects,
  imageWidth: number,
  imgheight: number
) {
  const imageWithoutAlpha = removeAlphaChannel(image);

  // downloadArrayAsTextFiles("image.txt", imageWithoutAlpha.data)
  const shape = image.size();

  let rotated_croped_images = [];
  let height = shape.height;
  let width = shape.width;

  let size = Math.floor((Math.sqrt(width ** 2 + height ** 2) + 2) * 2);
  const paddedimage = pad_image(
    imageWithoutAlpha.data,
    size,
    size,
    height,
    width
  );
// downloadArrayAsTextFiles("image.txt", paddedimage.flat(Infinity))
  let rects2D = [];
  for (let i = 0; i < rects.length; i += 5) {
    let rect = rects.subarray(i, i + 5);
    let newRect = new Float32Array(5);
    newRect[0] = rect[0] + Math.abs(size - width) / 2;
    newRect[1] = rect[1] + Math.abs(size - height) / 2;

    newRect[2] = rect[2];
    newRect[3] = rect[3];
    newRect[4] = rect[4];
    rects2D.push(newRect);
  }

  // Output the modified rects2D array

  // rects.forEach((rect) => {
  //   rect[0] = rect[0] + Math.abs(size - width) / 2;
  //   rect[1] = rect[1] + Math.abs(size - height) / 2;
  // });
  //
  const rect_bbx_upright = bounding_box_from_rotated_rect(rects2D);


  const rect_bbx_upright_images = cropRectangle(
    paddedimage,
    rect_bbx_upright,
    width,
    height
  );

  let rotated_rect_bbx_upright_images = image_rotation_without_crop(
    rect_bbx_upright_images,
    rects[4]
  );

  for (let i = 0; i < rotated_rect_bbx_upright_images.length; i++) {
    let rotated_rect_bbx_upright_image = rotated_rect_bbx_upright_images[i];
   
    let rect = rects[i];
    let crop_cx = Math.floor(rotated_rect_bbx_upright_image.cols / 2);
    let crop_cy = Math.floor(rotated_rect_bbx_upright_image.rows / 2);
    let rect_width = Math.floor(rects[2]);
    let rect_height = Math.floor(rects[3]);
    let startY = crop_cy - Math.floor(rect_height / 2);
    let endY = startY + rect_height;
    let startX = crop_cx - Math.floor(rect_width / 2);
    let endX = startX + rect_width;

    // Ensure the indices are within the bounds of the image
    startY = Math.max(startY, 0);
    endY = Math.min(endY, rotated_rect_bbx_upright_image.rows);
    startX = Math.max(startX, 0);
    endX = Math.min(endX, rotated_rect_bbx_upright_image.cols);

    let rotated_croped_image = rotated_rect_bbx_upright_image
      .rowRange(startY, endY)
      .colRange(startX, endX)
      .clone();

    rotated_croped_images.push(rotated_croped_image);
  }

  const float_rotated_croped_images = rotated_croped_images[0].data;
  // downloadArrayAsTextFiles("rotat.txt", float_rotated_croped_images)

  return rotated_croped_images;
}

function pad_image(image, resize_width, resize_height, height, width) {
  let image_height = height;
  let image_width = width;



  if (resize_width < image_width) {
    resize_width = image_width;
  }
  if (resize_height < image_height) {
    resize_height = image_height;
  }


  let padded_image = new Array(resize_height * resize_width * 3).fill(0);

  let start_h = Math.floor(resize_height / 2 - image_height / 2);
  let end_h = Math.floor(resize_height / 2 + image_height / 2);
  let start_w = Math.floor(resize_width / 2 - image_width / 2);
  let end_w = Math.floor(resize_width / 2 + image_width / 2);

  for (let h = start_h; h < end_h; h++) {
    for (let w = start_w; w < end_w; w++) {
      let index_padded = (h * resize_width + w) * 3;
      let index_original = ((h - start_h) * image_width + (w - start_w)) * 3;

      padded_image[index_padded] = image[index_original];
      padded_image[index_padded + 1] = image[index_original + 1];
      padded_image[index_padded + 2] = image[index_original + 2];
    }
  }
  let threeD_padded_image = [];
  for (let i = 0; i < resize_height; i++) {
    let row = [];
    for (let j = 0; j < resize_width; j++) {
      let idx = (i * resize_width + j) * 3;
      row.push([
        padded_image[idx],
        padded_image[idx + 1],
        padded_image[idx + 2],
      ]);
    }
    threeD_padded_image.push(row);
  }

  return threeD_padded_image;
}

function bounding_box_from_rotated_rect(rects) {
  let results = [];

  for (let rect of rects) {
    let cx = rect[0];
    let cy = rect[1];
    let width = rect[2];
    let height = rect[3];
    let angle = rect[4];
    let rectTuple = [[cx, cy], [width, height], angle];
    let box = boxPoints(rectTuple);


    let xMax = Math.max(...box.map((point) => point[0]));
    let xMin = Math.min(...box.map((point) => point[0]));
    let yMax = Math.max(...box.map((point) => point[1]));
    let yMin = Math.min(...box.map((point) => point[1]));
    cx = Math.floor((xMin + xMax) / 2);
    cy = Math.floor((yMin + yMax) / 2);
    width = Math.floor(xMax - xMin);
    height = Math.floor(yMax - yMin);
    angle = 0;

    results.push([cx, cy, width, height, angle]);
  }

  const resultsfloat = new Float32Array(results.flat());
  return results;
}

export function boxPoints(rectsTuple) {
  const [center, size, angle] = rectsTuple;
  const angleRad = angle * (Math.PI / 180);
  const boxHalfSize = [0.5 * size[0], 0.5 * size[1]];

  // Calculate the coordinates of the box points
  const box = [
    [
      center[0] -
        boxHalfSize[0] * Math.cos(angleRad) -
        boxHalfSize[1] * Math.sin(angleRad),
      center[1] -
        boxHalfSize[0] * Math.sin(angleRad) +
        boxHalfSize[1] * Math.cos(angleRad),
    ],

    [
      center[0] -
        boxHalfSize[0] * Math.cos(angleRad) +
        boxHalfSize[1] * Math.sin(angleRad),
      center[1] -
        boxHalfSize[0] * Math.sin(angleRad) -
        boxHalfSize[1] * Math.cos(angleRad),
    ],

    [
      center[0] +
        boxHalfSize[0] * Math.cos(angleRad) +
        boxHalfSize[1] * Math.sin(angleRad),
      center[1] +
        boxHalfSize[0] * Math.sin(angleRad) -
        boxHalfSize[1] * Math.cos(angleRad),
    ],

    [
      center[0] +
        boxHalfSize[0] * Math.cos(angleRad) -
        boxHalfSize[1] * Math.sin(angleRad),
      center[1] +
        boxHalfSize[0] * Math.sin(angleRad) +
        boxHalfSize[1] * Math.cos(angleRad),
    ],
  ];

  // Convert the coordinates to integers
  const boxInt = box.map((point) => point.map((coord) => Math.floor(coord)));

  return boxInt;
}

function isInsideRect(rects, widthOfOuterRect, heightOfOuterRect) {
  const insideOrOutsides = [];
  rects.forEach((rect) => {
    const [cx, cy, rectWidth, rectHeight] = rect;
    if (
      cx - rectWidth / 2 >= 0 &&
      cx + rectWidth / 2 <= widthOfOuterRect &&
      cy - rectHeight / 2 >= 0 &&
      cy + rectHeight / 2 <= heightOfOuterRect
    ) {
      insideOrOutsides.push(true);
    } else {
      insideOrOutsides.push(false);
    }
  });
  return insideOrOutsides;
}

function cropRectangle(image, rects) {
  const croppedImages = [];
  const height = image.length;
  const width = image[0].length;
  const insideOrOutsides = isInsideRect(rects, width, height);

  const filteredRects = rects.filter((_, i) => insideOrOutsides[i]);
  filteredRects.forEach((rect) => {
    const [cx, cy, rectWidth, rectHeight] = rect;
    const croppedImage = [];

    const cyplus = cy + rectHeight - Math.trunc(rectHeight / 2);
    const cyminus = cy - Math.trunc(rectHeight / 2);
    const cxplus = cx + rectWidth - Math.trunc(rectWidth / 2);
    const cxminus = cx - Math.trunc(rectWidth / 2);
    const empty3dArray = Array.from({ length: rectHeight }, () =>
      Array.from({ length: rectWidth }, () => Array(3).fill(0))
    );
    for (let i = cyminus; i < cyplus; i++) {
      for (let j = cxminus; j < cxplus; j++) {
        empty3dArray[i - cyminus][j - cxminus][0] = image[i][j][0];
        empty3dArray[i - cyminus][j - cxminus][1] = image[i][j][1];
        empty3dArray[i - cyminus][j - cxminus][2] = image[i][j][2];
      }
    }

    // for (let h = cyminus; h < cyplus; h++) {
    //   for (let w = cxminus; w < cxplus; w++) {
    //     croppedImage.push(image[h][w][0], image[h][w][1], image[h][w][2]);
    //   }
    // }

    croppedImages.push(empty3dArray);
    // const cvMatImage = cv.matFromArray(rectHeight, rectWidth, cv.CV_8UC3, empty3dArray.flat(2));
    // const canvasdraw = document.createElement('canvas');
    // canvasdraw.width = rectWidth;
    // canvasdraw.height = rectHeight;
    // document.body.appendChild(canvasdraw);
    // const canvasdrawctx = canvasdraw.getContext('2d');
    // const imageData = canvasdrawctx.createImageData(rectWidth, rectHeight);
    // for (let i = 0; i < empty3dArray.length; i++) {
    //   for (let j = 0; j < empty3dArray[i].length; j++) {
    //     const index = (i * rectWidth + j) * 4;
    //     imageData.data[index] = empty3dArray[i][j][0]; // R value
    //     imageData.data[index + 1] = empty3dArray[i][j][1]; // G value
    //     imageData.data[index + 2] = empty3dArray[i][j][2]; // B value
    //     imageData.data[index + 3] = 255; // Alpha value
    //   }
    // }
    // canvasdrawctx.putImageData(imageData, 0, 0);
  });

  // const canvasId = `canvasf`;
  // const canvasElement = document.createElement('canvas');
  // canvasElement.id = canvasId;
  // document.body.appendChild(canvasElement);
  // cv.imshow(canvasId, croppedImages);

  // downloadArrayAsTextFiles("cropsd.txt", croppedImages.flat(Infinity));
  return croppedImages;
}
function image_rotation_without_crop(images, angles) {
  const rotatedImages = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const angle = Math.trunc(angles);

    const mat = cv.matFromArray(
      image.length,
      image[0].length,
      cv.CV_8UC3,
      image.flat(Infinity)
    );


    const rotatedMat = new cv.Mat();
    const center = new cv.Point(
      Math.trunc(image[0].length / 2),
      Math.trunc(image.length / 2)
    );
    const rotationMatrix = cv.getRotationMatrix2D(center, angle, 1);
    let abs_cos = Math.abs(rotationMatrix.data64F[0]); // Accessing the first element of the matrix
    let abs_sin = Math.abs(rotationMatrix.data64F[1]); // Accessing the second element of the matrix
    let height = image.length;
    let width = image[0].length;
    let bound_w = parseInt(height * abs_sin + width * abs_cos);
    let bound_h = parseInt(height * abs_cos + width * abs_sin);

    rotationMatrix.data64F[2] += bound_w / 2 - center.x; // Adjusting the x translation
    rotationMatrix.data64F[5] += bound_h / 2 - center.y; // Adjusting the y translation
    cv.warpAffine(
      mat,
      rotatedMat,
      rotationMatrix,
      new cv.Size(bound_w, bound_h)
    );

    rotatedImages.push(rotatedMat);
  }

  // downloadArrayAsTextFiles("cropsd.txt", rotatedImages[0].data);
  return rotatedImages;
}

function removeAlphaChannel(image) {
  // Check if image has alpha channel
  let matWithoutAlpha = new cv.Mat();
  cv.cvtColor(image, matWithoutAlpha, cv.COLOR_BGRA2RGB);
  return matWithoutAlpha;
  // Return original image if it doesn't have an alpha channel
}
