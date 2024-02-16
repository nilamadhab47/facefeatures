//@ts-nocheck
import { handlelandmark } from "@/utils/HandleLandmark";
import {  rotate_and_crop_rectangle } from "@/utils/LandmarkimageHelper";
import { inferenceSqueezenetalign } from "@/utils/alignpredictt";
import { useEffect, useRef, useState } from "react";
import {boxPoints,drawHandLandmarks} from "@/utils/utils"
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
const VideoComponent = ({ session, videoRef }) => {
  const canvasRef = useRef(null);
const [cameraactive, setcameraactive] = useState(false)

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Ensure the canvas size matches the video size once the video metadata is loaded
            videoRef.current.onloadedmetadata = () => {
              if (canvasRef.current && videoRef.current) {
                setcameraactive(true)
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }
            };
          }
        })
        .catch((error) => {
          console.error("Error accessing the camera: ", error);
        });
    } else {
      console.error("getUserMedia not supported on your browser!");
    }
  }, []);

  const logVideoFrameData = (videoRef) => {
    const canvasvideoframe = document.createElement('canvas');
    const canvasvideoframecontext = canvasvideoframe.getContext('2d');

    const logFrame = async () => {
      if (videoRef.current) {
        canvasvideoframe.width = videoRef.current.videoWidth;
        canvasvideoframe.height = videoRef.current.videoHeight;
        canvasvideoframecontext.translate(canvasvideoframe.width, 0);
        canvasvideoframecontext.scale(-1, 1);
        canvasvideoframecontext.drawImage(videoRef.current, 0, 0, canvasvideoframe.width, canvasvideoframe.height);
        const imageData = canvasvideoframecontext.getImageData(0, 0, canvasvideoframe.width, canvasvideoframe.height);
        // console.log(imageData);
    const canvasimage =canvasvideoframe;

        const [inferenceResult] = await inferenceSqueezenetalign(
          canvasimage,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight,
          session[0]
        );
        // console.log("inferenceResult",inferenceResult);
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
              [(rects[i] * canvasvideoframe.width) / 640, (rects[i + 1] * canvasvideoframe.height) / 480],
              [(rects[i + 2] * canvasvideoframe.width) / 640, (rects[i + 3] * canvasvideoframe.hridgt) / 480],
              rects[i + 4],
            ];
    
            const imagedata = new cv.imread(canvasimage);
    
            const box = boxPoints(rects_tuple);
    const anglebox=rects_tuple[2]
            let rcx = Math.floor((rects[0] * canvasvideoframe.width) / 640);
            let rcy = Math.floor((rects[1] *  canvasvideoframe.height) / 480);
            let halfW = Math.floor((rects[2] * canvasvideoframe.width) / 640 / 2);
            let halfH = Math.floor((rects[3] *  canvasvideoframe.height) / 480 / 2);
            let x1 = rcx - halfW;
            let y1 = rcy - halfH;
            let x2 = rcx + halfW;
            let y2 = rcy + halfH;
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              const canvasWidthRatio = canvasRef.current.width / canvasvideoframe.width;
              const canvasHeightRatio = canvasRef.current.height /  canvasvideoframe.height;
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
              ctx.strokeStyle = 'red';
              ctx.stroke();
            }
            if (ctx) {
              // ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

              ctx.save();
              const canvasAspectRatioWidth = canvasRef.current.width / canvasvideoframe.width;
              const canvasAspectRatioHeight = canvasRef.current.height /  canvasvideoframe.height;
              const adjustedRcx = rcx * canvasAspectRatioWidth;
              const adjustedRcy = rcy * canvasAspectRatioHeight;
              const adjustedHalfW = halfW * canvasAspectRatioWidth;
              const adjustedHalfH = halfH * canvasAspectRatioHeight;
              ctx.translate(adjustedRcx, adjustedRcy);
              ctx.rotate(anglebox * Math.PI / 180);
              ctx.strokeStyle = 'green';
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
              canvasRef.current.width ,
              canvasRef.current.height
            );
    
            const [handle_landmark, rotated_image_size_leftrights] =
          await handlelandmark(croptedRotatedinferenceResultsImages, rects,session[1]);
          imagedata.delete();
          resizedImage.delete();
          croptedRotatedinferenceResultsImages.forEach((image) => image.delete());
          if (handle_landmark.length > 0) {
            
           
  
            for (const landmarks of handle_landmark) {
              ctx.save();
              ctx.translate(canvasRef.current.width  / 2, canvasRef.current.height  / 2);
              ctx.scale(1, 1); 
              ctx.translate(-canvasRef.current.width  / 2, -canvasRef.current.height  / 2);
              drawHandLandmarks(ctx, landmarks,lines_hand);
               // Draw hand landmarks on the canvas
              ctx.restore();
            }
          }
          
          }
          
        }
        
      // document.body.append(canvasvideoframe);
      }
      requestAnimationFrame(logFrame);
    };

    logFrame();
  };

  // Call the logVideoFrameData function here
  useEffect(() => {
    console.log("logVideoFrameData",videoRef.current.videoWidth)
    if (videoRef.current && videoRef.current.videoWidth !== 0) {
      logVideoFrameData(videoRef);
    }
  }, [cameraactive]);

  return (
    <div style={{ position: 'relative', width: "640px", height: "480px" }} >
      <video ref={videoRef} autoPlay playsInline style={{ transform: 'scaleX(-1)', position: 'absolute', top: 0, left: 0 }}></video>
      <canvas ref={canvasRef} style={{  position: 'absolute', top: 0, left: 0, zIndex: 1 }}></canvas>
    </div>
  );
};

export default VideoComponent;