"use client";
import Image from 'next/image'
import ImageCanvas from '@/components/ImageCanvas'
import { runInference, runSqueezenetModel } from '@/utils/alignmodelhelper'
import { useEffect } from 'react';
import VIdeoImage from '@/components/VIdeoImage';

export default function Home() {
  useEffect(() => {
    // runInference()
    // runSqueezenetModel()
  }, )
  return (
    <>
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
      {/* <ImageCanvas width={640} height={480}/> */}
      <VIdeoImage />

    </main>
      <script
        async
        src="https://docs.opencv.org/master/opencv.js"
        onLoad="onOpenCvReady();"
        type="text/javascript"
      ></script>
    </>

  )
}
