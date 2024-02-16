"use client";
import React, { useRef, useEffect, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import LoadingOverlay from "react-loading-overlay";
import {
  connectPolygons,
  connectPairs,
  drawfacebox,
  compareToGallery,
  averagefeatures,
} from "./utils";
import { getImageTensorFromPath } from "./MbfModel";
import { floatArrayToBase64, base64ToFloatArray } from "./utils";
import {
  canvasConstants,
  boundingBoxConstants,
  faceConnectionPairs,
  facePolygons,
} from "./constants";
import { IoIosArrowDown } from "react-icons/io";
import { ImCross } from "react-icons/im";

import axios from "axios";
import Link from "next/link";
import { Facedetection } from "./Facedetection";
import { SessionInstance } from "twilio/lib/rest/proxy/v1/service/session";
import { alignmyimage } from "./alignmyimage";
const DetectImage = ({ session, userId, width = 600, height = 500, name }) => {
  const canvasRef = useRef(null);
  const [failedText, setFailedText] = useState("");
  const [showLoader, setShowLoader] = useState(false);
  const [SuccessText, setSuccessText] = useState("");
  const [images, setImages] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedOptionText, setSelectedOptionText] = useState("");
  const inputRef = useRef(null);
  const [Template, setTemplate] = useState(null);
  const [imposterImages, setImposterImages] = useState([]);
  const [nonImposterImages, setNonImposterImages] = useState([]);
  const [customLabelText, setCustomLabelText] = useState("");

  const handleImageUpload = async (event) => {
    setFailedText("");
    setSuccessText("");
    setShowLoader(true);
    const file = event.target.files[0];

    if (file) {
      const reader = new FileReader();
      if (typeof window !== "undefined") {
        if (file.size >= 10 * 1024 && file.size <= 50 * 1024) {
          reader.onload = (e) => {
            const image = new Image();
            image.src = URL.createObjectURL(file);

            image.onload = () => {
              const canvas = canvasRef.current;
              if (!canvas) return;

              const ctx = canvas.getContext("2d");
              if (!ctx) return;

              // Clear main canvas and draw the new image
              ctx.clearRect(0, 0, 600, 500);
              ctx.drawImage(image, 0, 0, 600, 500);
              submitInference(image.width, image.height, ctx, image);
            };
          };
        } else {
          setFailedText("Image Size is not within range.");

          console.log("File size is not within the specified range");
          setShowLoader(false);

          return;
        }

        async function submitInference(imgWidth, imgHeight, ctx, image) {
          setShowLoader(true);
          const canvasimage = document.createElement("canvas");
          const canvasimagectx = canvasimage.getContext("2d");
          canvasimage.width = imgWidth;
          canvasimage.height = imgHeight;
          canvasimagectx.drawImage(image, 0, 0, imgWidth, imgHeight);
          const imratio = imgHeight / imgWidth;
          let newheight = 0;
          let newwidth = 0;
          if (imratio > 1) {
            newheight = 640;
            newwidth = Math.floor(newheight / imratio);
          } else {
            newwidth = 640;
            newheight = Math.floor(newwidth * imratio);
          }
          const imagedata = cv.imread(canvasimage);
          let resizedimage = new cv.Mat();
          let dsize = new cv.Size(newwidth, newheight);
          console.log("imagedata", imagedata);
          cv.resize(imagedata, resizedimage, dsize, 0, 0, cv.INTER_AREA);

          const session10g = session[2];

          let [bboxes, kpss] = await Facedetection(
            resizedimage,
            imgHeight,
            imgWidth,
            session10g
          );
          let alignedimage = null;
          console.log("bboxes", bboxes, kpss);
          bboxes = bboxes.filter((bbox) => bbox !== undefined);
          kpss = kpss.filter((kps) => kps !== undefined);
          let largestBbox = [];
          let largestkpss = [];
          if (bboxes.length > 0) {
            let largestArea = 0;

            for (let i = 0; i < bboxes.length; i++) {
              const bbox = bboxes[i];
              const [x1, y1, x2, y2, score] = bbox.map((coord) =>
                Math.round(coord)
              );
              const area = (x2 - x1) * (y2 - y1);

              if (area > largestArea) {
                largestArea = area;
                largestBbox = [bbox];
              }
            }
          }
          if (largestBbox.length > 0) {
            const [x1, y1, x2, y2, score] = largestBbox[0].map((coord) =>
              Math.round(coord)
            );

            for (let i = 0; i < kpss.length; i++) {
              const kps = kpss[i];
              if (kps !== null) {
                for (let j = 0; j < kps.length; j++) {
                  const kpsss = kps[j];
                  for (let k = 0; k < Math.min(2, kpsss.length); k++) {
                    const kp = kpsss[k].map((coord) => Math.round(coord));

                    const [x, y] = kp;

                    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                      largestkpss = [kpss[i]];
                    }
                  }
                }
              }
            }
          }

          if (largestBbox.length > 0 && largestkpss.length > 0) {
            bboxes = largestBbox;
            kpss = largestkpss;
            const srcpoints = [];
            for (let i = 0; i < bboxes.length; i++) {
              const bbox = bboxes[i];
              const [x1, y1, x2, y2, score] = bbox.map((coord) =>
                Math.round(coord)
              );

              const aspectRatio = imgWidth / imgHeight;

              const rectX = x1 * (width / imgWidth);
              const rectY = y1 * (height / imgHeight);
              const rectWidth = (x2 - x1) * (width / imgWidth);
              const rectHeight = (y2 - y1) * (height / imgHeight);
              console.log("x,y", x1, y1, x2, y2);
              console.log(
                "imgHeight,imgHeight",
                width,
                imgWidth,
                height,
                imgHeight
              );

              ctx.strokeStyle = "red";
              ctx.lineWidth = 2;
              ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
              if (kpss !== null) {
                const kps = kpss[i];
                for (let j = 0; j < kps.length; j++) {
                  console.log("kp", kps[j]);
                  const kpsss = kps[j];

                  for (let k = 0; k < kpsss.length; k++) {
                    const kp = kpsss[k].map((coord) => Math.round(coord));
                    console.log("kp", kp);
                    srcpoints.push(kp);
                    for (let m = 0; m < kp.length; m++) {
                      const [x, y] = kp;

                      const circleX = x * (width / imgWidth);
                      const circleY = y * (height / imgHeight);
                      const circleRadius = 5; // Set the radius of the circle
                      ctx.beginPath();
                      ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
                      ctx.fillStyle = "blue"; // Set the color of the circle
                      ctx.fill();
                    }
                  }
                }
              }
            }

            console.log("srcc", srcpoints);
            const refpoints = [
              [-1.58083929e-1, -3.84258929e-2],
              [1.56533929e-1, -4.01660714e-2],
              [2.25e-4, 1.40505357e-1],
              [-1.29024107e-1, 3.24691964e-1],
              [1.31516964e-1, 3.23250893e-1],
            ];
            var tfm = await alignmyimage(
              imagedata,
              imgHeight,
              imgWidth,
              srcpoints,
              refpoints
            );

            let srcmat = imagedata;
            console.log("tfm", tfm);
            var tfm1 = [
              tfm[0][0],
              tfm[0][1],
              tfm[0][2],
              tfm[1][0],
              tfm[1][1],
              tfm[1][2],
            ];
            console.log("tfm1", tfm1); // Example values, replace with your own
            let dstMat = new cv.Mat();
            console.log(dstMat);
            const M = new cv.Mat(2, 3, cv.CV_64F);
            M.data64F.set(tfm1);
            console.log("mamskjndajsbc", srcmat.data.shape);

            console.log("mamskjndajsbc", M, srcmat, dstMat);
            cv.warpAffine(srcmat, dstMat, M, new cv.Size(112, 112));
            alignedimage = dstMat;
            cv.imshow(canvasimage, dstMat);

            // document.body.appendChild(canvasimage);
          }

          const isPassed = true;
          // Print or use the result
          if (isPassed) {
            const tensor = await getImageTensorFromPath(
              alignedimage,
              session[0]
            );
            const floatfeatures = floatArrayToBase64(tensor);
            const facefeatures = base64ToFloatArray(floatfeatures);
            console.log("facefeatures", facefeatures);
            if (Template === null) {
              setNonImposterImages([
                ...nonImposterImages,
                {
                  index: nonImposterImages.length,
                  facefeatures,
                  src: canvasimage.toDataURL(),
                },
              ]);
            } else {
              const matchfeatures = await compareToGallery(
                facefeatures,
                Template
              );
              console.log("match features", matchfeatures);
              if (matchfeatures > 0.3) {
                const averagefeature = averagefeatures(facefeatures, Template);

                setNonImposterImages([
                  ...nonImposterImages,
                  {
                    index: nonImposterImages.length,
                    facefeatures,
                    src: canvasimage.toDataURL(),
                  },
                ]);
              } else {
                const ImposterFeatures = facefeatures;

                setImposterImages([
                  ...imposterImages,
                  {
                    index: imposterImages.length,
                    facefeatures,
                    src: canvasimage.toDataURL(),
                  },
                ]);

                console.log("imposter");
              }
            }

            setShowLoader(false);
            setSuccessText("Face Detected and Data Saved.");
          } else {
            setFailedText("Face Detected but Face is Not Aligned");
            setShowLoader(false);

            console.log("Failed");
          }
        }
        event.target.value = "";
      }

      reader.readAsDataURL(file);
    }
  };
  const updateTemplate = () => {
    if (nonImposterImages.length > 0) {
      const nonImposterFeatures = nonImposterImages.map(
        (image) => image.facefeatures
      );
      const averageFeature = nonImposterFeatures
        .reduce((acc, curr) => {
          return acc.map((val, i) => val + curr[i]);
        }, new Array(nonImposterFeatures[0].length).fill(0))
        .map((val) => val / nonImposterFeatures.length);
      setTemplate([averageFeature]);
    } else if (imposterImages.length > 0) {
      const firstImposterImage = imposterImages[0];
      setTemplate([firstImposterImage.facefeatures]);
    } else {
      setTemplate(null);
    }
  };

  const handleRemoveImage = (index, isImposter) => {
    console.log("removeindex", index);
    if (isImposter) {
      const updatedImposterImages = imposterImages.filter(
        (_, i) => i !== index
      );
      console.log("updatedImposterImages", updatedImposterImages);

      setImposterImages(updatedImposterImages);
    } else {
      const updatedNonImposterImages = nonImposterImages.filter(
        (_, i) => i !== index
      );
      if (updatedNonImposterImages.length === 0 && imposterImages.length > 0) {
        const firstImposterImage = imposterImages[0];
        setNonImposterImages([firstImposterImage]);
        setImposterImages(imposterImages.slice(1));
      } else {
        setNonImposterImages(updatedNonImposterImages);
      }
    }
  };
  useEffect(() => {
    updateTemplate();
  }, [nonImposterImages, imposterImages]);

  useEffect(() => {
    imposterImages.map((image, index) => {
      const scorematch = compareToGallery(image.facefeatures, Template);
      console.log(scorematch);
      if (scorematch > 0.3) {
        setNonImposterImages([...nonImposterImages, image]);
        setImposterImages(imposterImages.filter((_, i) => i !== index));
      }
      console.log(
        `Imposter Image ${index + 1} - src: ${image.src}, facefeatures: ${
          image.facefeatures
        }`
      );
    });
    if (Template) {
      const apiUpdateTemplate = async () => {
        const postDataOtp = {
          userId: userId,
          templateFeatures: JSON.stringify(Template[0]),
        };
        try {
          if (postDataOtp.userId) {
            const response = await axios.post(`/api/saveTemplate`, postDataOtp);
            if (response?.data) {
              getUser(response?.data?.data?.userId);
            }
            localStorage.setItem(
              "faceId",
              JSON.stringify(response?.data?.data?.id)
            );
            console.log(response?.data?.data?.userId);
          }
        } catch (error) {
          console.error("Error updating template:", error);
        }
      };
      apiUpdateTemplate();
    }
  }, [Template]);

  const handleAddToGallery = () => {
    console.log("handle clicked");
    console.log("Non-Imposter Images:");
    nonImposterImages.map((image, index) => {
      console.log(
        `Non-Imposter Image ${index + 1} - src: ${image.src}, facefeatures: ${
          image.facefeatures
        }`
      );
    });
    console.log("Imposter Images:");
    imposterImages.map((image, index) => {
      console.log(
        `Imposter Image ${index + 1} - src: ${image.src}, facefeatures: ${
          image.facefeatures
        }`
      );
    });
  };

  return (
    <>
      <div className="flex flex-col justify-center items-center relative w-full  mx-auto md:w-[900px] space-y-5 h-auto">
        <div className="space-y-5 flex-1">
          <div className="text-center text-2xl text-white">
            <p>Upload Images from the gallery</p>
          </div>
          <div className="space-y-2">
            <div className="text-start">
              <span className="text-sm text-white text-start">Name</span>
            </div>
            <div className="space-y-2 relative">
              <div
                className={`box-content border border-gray-300 text-white ${
                  name ? "py-2" : "py-5"
                } md:w-[450px] flex items-center justify-between md:px-5 px-2 rounded-md`}
              >
                {name}
              </div>
            </div>
          </div>
        </div>
        <LoadingOverlay active={showLoader} spinner text="Loading...">
          <div className="justify-center items-center">
            <div className="justify-center items-center text-center text-xs text-gray-300">
              <div className="font-medium">Instructions to add Image:</div>{" "}
              <br />
              <span>
                {" "}
                1. Size must should be between 10kb and 50kb.
                <br />
                2. Face should not be too far in image.
                <br />
                3. Face should be properly aligned in front.
                <br />
              </span>
            </div>
          </div>
          <div className="flex-col justify-start items-start">
            <div
              className={`flex flex-col justify-center items-center ${
                nonImposterImages.length > 0 && "px-11 md:px-0"
              }`}
            >
              <div
                className={`${
                  nonImposterImages.length > 0 ? "grid" : "flex"
                } grid-cols-2 md:grid-cols-3 justify-center items-center w-full mx-auto mt-4 gap-8`}
              >
                {nonImposterImages.map((image, index) => (
                  <div
                    key={index}
                    style={{ position: "relative", margin: "5px" }}
                  >
                    <img
                      src={image.src}
                      alt={`Non-Imposter Image ${index}`}
                      style={{
                        width: "200px",
                        height: "200px",
                      }}
                      className="border-gray-400 border rounded-md"
                    />
                    <ImCross
                      className="text-xl m-2 absolute top-0 right-0 text-red-600 bg-white p-1 cursor-pointer hover:scale-110 rounded-md"
                      onClick={() => handleRemoveImage(index, false)}
                    />
                  </div>
                ))}
                {imposterImages.map((image, index) => (
                  <div
                    key={index}
                    style={{ position: "relative", margin: "5px" }}
                  >
                    <img
                      src={image.src}
                      alt={`Imposter Image ${index}`}
                      style={{
                        width: "200px",
                        height: "200px",
                        borderRadius: "5%",
                        border: "2px solid black",
                        filter: "blur(3px)",
                      }}
                    />
                    <ImCross
                      className="text-xl m-2 absolute top-0 right-0 text-red-600 bg-white p-1 cursor-pointer hover:scale-110 rounded-md"
                      onClick={() => handleRemoveImage(index, true)}
                    />
                  </div>
                ))}
                <div
                  className={`mt-5 w-full ${
                    nonImposterImages.length > 0
                      ? "md:w-[200px]"
                      : "md:w-[500px]"
                  }  mx-auto object-cover py-12 px-5 rounded-xl bg-slate-300 bg-opacity-20 border border-dashed border-gray-400  cursor-pointer text-center`}
                >
                  <label
                    htmlFor="image-upload"
                    className="w-full h-auto object-cover rounded-xl flex-col flex justify-center items-center cursor-pointer"
                  >
                    <label htmlFor="imageUpload">
                      <img
                        src="UploadImage.png"
                        alt="Upload Image"
                        style={{
                          width: "40px",
                          height: "40px",
                          cursor: "pointer",
                          borderRadius: "10px",
                        }}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        id="imageUpload"
                        ref={inputRef}
                        style={{ display: "none" }}
                        onChange={handleImageUpload}
                      />
                    </label>
                    <p className="text-gray-300 text-[12px] w-full mt-2">
                      Drop your images here
                    </p>
                  </label>
                </div>
              </div>

              <canvas
                className="hidden"
                ref={canvasRef}
                id="canvasOutput"
                width="600"
                height="500"
              ></canvas>
            </div>

            {failedText && (
              <div className="flex justify-center items-center mt-5 text-sm">
                <p className="text-red-400">{failedText}</p>
              </div>
            )}
            {SuccessText && (
              <div className="flex justify-center items-center mt-5 text-sm">
                <p className="text-green-400">{SuccessText}</p>
              </div>
            )}
          </div>
          <div className="mx-auto flex justify-center items-center duration-300 cursor-pointer mb-10">
            {nonImposterImages.length > 0 && (
              <Link
                href={{
                  pathname: "/details",
                  query: {
                    previousPage: "/information",
                  },
                }}
              >
                <button
                  className={`md:w-[500px] w-auto ${
                    nonImposterImages.length > 0
                      ? "bg-gradient-to-r from-[#0A62CE] to-[#11E4FF] cursor-pointer duration-300"
                      : "bg-gray-600"
                  } md:px-3 px-5 rounded-lg py-2 mt-5`}
                  onClick={handleAddToGallery}
                >
                  Add to Gallery
                </button>
              </Link>
            )}
          </div>
        </LoadingOverlay>
      </div>
      <script
        async
        src="https://docs.opencv.org/master/opencv.js"
        onload="onOpenCvReady();"
        type="text/javascript"
      ></script>
    </>
  );
};
export default DetectImage;
