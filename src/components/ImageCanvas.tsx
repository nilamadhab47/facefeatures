//@ts-nocheck
"use client";
import React, { useRef, useState, ChangeEvent, useEffect } from "react";
import { inferenceSqueezenetalign } from "../utils/alignpredictt";
import { getImageTensorFromPath } from "../utils/mbfmodel";
import { rotate_and_crop_rectangle } from "@/utils/LandmarkimageHelper";
import { handlelandmark } from "@/utils/HandleLandmark";
import { Console } from "console";
import { downloadArrayAsTextFiles } from "@/utils/alignimagehelper";
import { boxPoints, drawHandLandmarks } from "@/utils/utils";

interface Props {
  height: number;
  width: number;
}

let lines_hand = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const ImageCanvas: React.FC<Props> = ({ height, width, session }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvassRef = useRef<HTMLCanvasElement>(null);
  const [inferenceTime, setInferenceTime] = useState("");
  const [faceDataArray, setFaceDataArray] = useState([]);

  const drawBoundingBox = (ctx: CanvasRenderingContext2D, b: number[]) => {
    const [
      x1,
      y1,
      x2,
      y2,
      confidence,
      text1,
      lx1,
      ly1,
      lx2,
      ly2,
      lx3,
      ly3,
      lx4,
      ly4,
      lx5,
      ly5,
    ] = b;

    if (confidence < 0.6) return;

    // Draw bounding box
    ctx.strokeStyle = "rgb(0, 0, 255)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(x1, y1, x2 - x1, y2 - y1);
    ctx.stroke();

    // Display confidence
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.font = "12px sans-serif";
    ctx.fillText(confidence.toFixed(4), x1, y1 + 12);

    // Draw circles for facial landmarks
    const circleColors = [
      "rgb(0, 0, 255)",
      "rgb(0, 255, 255)",
      "rgb(255, 0, 255)",
      "rgb(0, 255, 0)",
      "rgb(255, 0, 0)",
    ];
    for (let i = 5; i < b.length; i += 2) {
      const x = b[i];
      const y = b[i + 1];

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = circleColors[(i - 5) / 2];
      ctx.fill();
    }
  };

  const displayImageAndRunInference = async (file: File) => {
    if (!file) return;
    // Clear all existing canvases and remove rotated face canvases from the DOM
    const canvases = document.querySelectorAll("canvas");
    canvases.forEach((canvas) => {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    });

    const rotatedFaceCanvases = document.querySelectorAll(
      "#rotated-face-container canvas"
    );
    rotatedFaceCanvases.forEach((canvas) => canvas.remove());

    const image = new Image();
    image.src = URL.createObjectURL(file);

    setInferenceTime("");

    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Clear main canvas and draw the new image flipped horizontally
      ctx.clearRect(0, 0, width, height);
      // ctx.translate(width, 0);
      // ctx.scale(1, 1);
      ctx.drawImage(image, 0, 0, width, height);
      submitInference(
        image.width,
        image.height,
        file,
        ctx,
        image.src,
        canvases
      );
    };
  };

  const submitInference = async (
    imgWidth: number,
    imgHeight: number,
    file: File,
    ctx: CanvasRenderingContext2D,
    image,
    imagePath: string,
    canvases
  ) => {
    const startTime = performance.now();
    const args = { vis_thres: 0.6 };
    const faceDataArray = [];

    // Create a container for the canvases
    const container = document.createElement("div");
    container.id = "rotated-face-container";
    container.style.display = "flex"; // Set display to flex for horizontal alignment
    container.style.flexWrap = "wrap"; // Allow items to wrap to the next line
    container.style.alignItems = "center"; // Align items in the center vertically
    container.style.justifyContent = "center"; // Center items horizontally
    container.style.gap = "5px"; // Add a gap of 5 pixels between items
    document.body.appendChild(container);
    const canvasimage = canvasRef.current;

    const [inferenceResult] = await inferenceSqueezenetalign(
      canvasimage,
      imgWidth,
      imgHeight,
      session[0]
    );
    let rects = [];
    const notRotateRects = [];
    let rectsTuple = null;
    let croptedRotatedinferenceResultsImages = [];

    const capWidth = 640;
    const capHeight = 480;

    const whRatio = capWidth / capHeight;

    if (inferenceResult.length > 0) {
      for (const y in inferenceResult) {
        // inferenceResult: sqn_rr_size, rotation, sqn_rr_center_x, sqn_rr_center_y
        let sqnRrSize = inferenceResult[0][0];
        let rotation = inferenceResult[0][1];
        let sqnRrCenterX = inferenceResult[0][2];
        let sqnRrCenterY = inferenceResult[0][3];
        let cx = Math.floor(sqnRrCenterX * capWidth);
        let cy = Math.floor(sqnRrCenterY * capHeight);
        let xmin = Math.floor((sqnRrCenterX - sqnRrSize / 2) * capWidth);
        let xmax = Math.floor((sqnRrCenterX + sqnRrSize / 2) * capWidth);
        let ymin = Math.floor(
          (sqnRrCenterY - (sqnRrSize * whRatio) / 2) * capHeight
        );
        let ymax = Math.floor(
          (sqnRrCenterY + (sqnRrSize * whRatio) / 2) * capHeight
        );
        xmin = Math.max(0, xmin);
        xmax = Math.min(capWidth, xmax);
        ymin = Math.max(0, ymin);
        ymax = Math.min(capHeight, ymax);
        const degree = rotation * (180 / Math.PI);
        rects.push([cx, cy, xmax - xmin, ymax - ymin, degree]);
      }
      rects = new Float32Array(rects.flat());
      for (let i = 0; i < rects.length; i += 5) {
        const rects_tuple = [
          [(rects[i] * imgWidth) / 640, (rects[i + 1] * imgHeight) / 480],
          [(rects[i + 2] * imgWidth) / 640, (rects[i + 3] * imgHeight) / 480],
          rects[i + 4],
        ];

        const imagedata = new cv.imread(canvasimage);

        const box = boxPoints(rects_tuple);
        const anglebox = rects_tuple[2];
        let rcx = Math.floor((rects[0] * imgWidth) / 640);
        let rcy = Math.floor((rects[1] * imgHeight) / 480);
        let halfW = Math.floor((rects[2] * imgWidth) / 640 / 2);
        let halfH = Math.floor((rects[3] * imgHeight) / 480 / 2);
        let x1 = rcx - halfW;
        let y1 = rcy - halfH;
        let x2 = rcx + halfW;
        let y2 = rcy + halfH;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          const canvasWidthRatio = canvasRef.current.width / imgWidth;
          const canvasHeightRatio = canvasRef.current.height / imgHeight;
          const adjustedX1 = x1 * canvasWidthRatio;
          const adjustedY1 = y1 * canvasHeightRatio;
          const adjustedX2 = x2 * canvasWidthRatio;
          const adjustedY2 = y2 * canvasHeightRatio;

          ctx.beginPath();
          ctx.moveTo(adjustedX1, adjustedY1);
          ctx.lineTo(adjustedX2, adjustedY1);
          ctx.lineTo(adjustedX2, adjustedY2);
          ctx.lineTo(adjustedX1, adjustedY2);
          ctx.closePath();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "red";
          ctx.stroke();
        }
        if (ctx) {
          ctx.save();
          const canvasAspectRatioWidth = canvasRef.current.width / imgWidth;
          const canvasAspectRatioHeight = canvasRef.current.height / imgHeight;
          const adjustedRcx = rcx * canvasAspectRatioWidth;
          const adjustedRcy = rcy * canvasAspectRatioHeight;
          const adjustedHalfW = halfW * canvasAspectRatioWidth;
          const adjustedHalfH = halfH * canvasAspectRatioHeight;
          ctx.translate(adjustedRcx, adjustedRcy);
          ctx.rotate((anglebox * Math.PI) / 180);
          ctx.strokeStyle = "green";
          ctx.beginPath();
          ctx.moveTo(-adjustedHalfW, -adjustedHalfH);
          ctx.lineTo(adjustedHalfW, -adjustedHalfH);
          ctx.lineTo(adjustedHalfW, adjustedHalfH);
          ctx.lineTo(-adjustedHalfW, adjustedHalfH);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        const resizedImage = new cv.Mat();
        cv.resize(
          imagedata,
          resizedImage,
          new cv.Size(640, 480),
          0,
          0,
          cv.INTER_LINEAR
        );

        croptedRotatedinferenceResultsImages = rotate_and_crop_rectangle(
          resizedImage,
          rects,
          imgWidth,
          imgHeight
        );

        const [handle_landmark, rotated_image_size_leftrights] =
          await handlelandmark(
            croptedRotatedinferenceResultsImages,
            rects,
            session[1]
          );
        imagedata.delete();
        resizedImage.delete();
        croptedRotatedinferenceResultsImages.forEach((image) => image.delete());

        if (handle_landmark.length > 0) {
          for (const landmarks of handle_landmark) {
            ctx.save();
            ctx.translate(imgWidth / 2, imgHeight / 2);
            ctx.scale(1, 1);
            ctx.translate(-imgWidth / 2, -imgHeight / 2);
            drawHandLandmarks(ctx, landmarks, lines_hand); // Draw hand landmarks on the canvas
            ctx.restore();
          }
        }
      }
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;
    setInferenceTime(`Inference speed: ${executionTime / 1000} seconds`);
  };

  function drawContours(box, color, thickness, lineType) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const aspectRatio = canvas.width / canvas.height;

    ctx.beginPath();
    ctx.moveTo(box[0][0], box[0][1]);

    for (let i = 1; i < box.length; i++) {
      const adjustedX = box[i][0] + (box[i][0] - box[0][0]) * (aspectRatio - 1);
      ctx.lineTo(adjustedX, box[i][1]);
    }

    ctx.lineTo(box[0][0], box[0][1]);

    ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.lineWidth = thickness;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.stroke();
  }

  const inferenceResultleDownload = () => {
    // Convert the faceDataArray to a JSON string
    const faceDataJson = JSON.stringify(faceDataArray);

    // Create a Blob with the JSON data
    const blob = new Blob([faceDataJson], { type: "application/json" });

    // Create a download link and trigger the download
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "FeatureVector.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => displayImageAndRunInference(e.target.files?.[0])}
      />

      <br />
      <canvas ref={canvasRef} width={width} height={height} />
      {/* <canvas ref={canvassRef} width={width} height={height} /> */}

      {faceDataArray.length > 0 && (
        <button
          style={{ border: "1px solid black", marginTop: "10px" }} // Adjust styles as needed
          onClick={inferenceResultleDownload}
        >
          Download Face Data
        </button>
      )}

      <span>{inferenceTime}</span>
    </>
  );
};

export default ImageCanvas;
