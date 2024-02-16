//@ts-nocheck
// Language: typescript
// Path: react-next\utils\predict.ts
import { downloadArrayAsTextFile, getImageTensorFromPath } from "./alignimagehelper";
import { runSqueezenetModel } from "./alignmodelhelper";

export async function inferenceSqueezenetalign(
  canvasimage: any,
  imgwidth: number,
  imgheight: number,
  session:any
): Promise<[any, number]> {
  // 1. Convert image to tensor
  const imageTensor = await getImageTensorFromPath(canvasimage, imgwidth, imgheight);
  // 2. Run model
  // const boxes =imageTensor.data

  const [runSqueezenetModelresult] = await runSqueezenetModel(
    imageTensor,
    imgwidth,
    imgheight,
    session
  );

  // 3. Return predictions and the amount of time it took to inference.
  return [runSqueezenetModelresult];
}
