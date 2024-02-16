// @ts-nocheck
"use client";
import React, { useState, useEffect ,useRef} from "react";
import * as ort from "onnxruntime-web";
import ImageCanvas from "./ImageCanvas";
import VideoComponent from "./VideoComponent"

// import ImageUploadModal from './LensView'
// import AddFace from './AddFace';
// import DynamicMainFaceMesh from './DynamicImport';
const VIdeoImage = () => {
  const [showDetect, setShowDetect] = useState(false);
  const [showAddFace, setShowAddFace] = useState(false);
  const [session, setSession] = useState(null);
  const [showLoader, setShowLoader] = useState(true);
  const videoRef = useRef(null); // Create a reference to the video element

  const handleDetectClick = () => {
    setShowDetect(true);
    setShowAddFace(false);
  };

  const handleAddFaceClick = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
    }
    setShowAddFace(true);
    setShowDetect(false);
  };
  const getSession = async () => {
    const session_palm_detection = await ort.InferenceSession.create(
        "./_next/static/chunks/palm_detection_full_inf_post_192x192.onnx",
    
        { executionProviders: ["wasm"], graphOptimizationLevel: "all" }
      );
      const session_hand_landmark = await ort.InferenceSession.create(
        "./_next/static/chunks/hand_landmark_sparse_N.onnx",
    
        { executionProviders: ["wasm"], graphOptimizationLevel: "all" }
      );
    console.log("session created");
    return [session_palm_detection, session_hand_landmark];
  };

  useEffect(() => {
    const fetchSession = async () => {
      const result = await getSession();
      setSession(result);
      setShowLoader(false); // Hide the loader once the session is created
    };

    if (!session) {
      fetchSession();
    }
  }, [session]);
  return (
    <div className="items-center justify-center ">
      {showLoader && <div>Loading ....</div>}{" "}
      {!showLoader && (
        <div className="text-center justify-center items-center flex gap-20">
          <img
            src="webcam.jpeg"
            alt="Button of Webcam"
            style={{ width: "200px", height: "200px", borderRadius: "10px" }}
            className="cursor-pointer"
            onClick={() => handleDetectClick()}
          />
          <img
            src="imageupload.png"
            alt="Button of Image Upload"
            style={{ width: "200px", height: "200px", borderRadius: "10px" }}
            className="cursor-pointer ml-4"
            onClick={() => handleAddFaceClick()}
          />
        </div>
      )}
      <div>
        {showDetect && <VideoComponent session={session} videoRef={videoRef} />}
        {showAddFace && <ImageCanvas width={640} height={480} session={session}/>}
      </div>
    </div>
  );
};

export default VIdeoImage;
