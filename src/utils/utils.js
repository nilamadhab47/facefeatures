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



  export function drawHandLandmarks(ctx, landmarks, pairs) {
    const circleColors = [
      "rgb(0, 0, 255)",
      "rgb(0, 255, 255)",
      "rgb(255, 0, 255)",
      "rgb(0, 255, 0)",
      "rgb(255, 0, 0)",
    ];

    // Draw circles for all landmarks
    for (let i = 0; i < landmarks.length; i++) {
      const x = landmarks[i][0];
      const y = landmarks[i][1];

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = circleColors[i % 5];
      ctx.fill();

      
    }

    // Connect pairs of landmarks with lines
    pairs.forEach(pair => {
      const x1 = landmarks[pair[0]][0];
      const y1 = landmarks[pair[0]][1];
      const x2 = landmarks[pair[1]][0];
      const y2 = landmarks[pair[1]][1];

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "black";
      ctx.stroke();
    });
};