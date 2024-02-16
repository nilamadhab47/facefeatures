//@ts-nocheck
const fs = require('fs');
const path = require('path');

function readAndConvertToArray() {
  try {
    const fileContent = fs.readFileSync("./inference_imagejsjs.txt", 'utf-8');
    const array = fileContent.split(',').map(item => item.trim());
    return array;
  } catch (error) {
    console.error('Error reading the file:', error);
    return [];
  }
}

const filePath = path.join(__dirname, 'inference_imagejsjs.txt');
const array = readAndConvertToArray(filePath);
console.log('Converted array:', array);

const downloadFile = async (url: string, destination: string) => {
  const axios = require('axios');
  const writer = fs.createWriteStream(destination);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

const fileUrl = '/Users/nilamadhabsenapati/Documents/facefeatures/inference_imagejsjs.txt';
const destinationPath = path.join(__dirname, 'inference_imagejsjs.txt');
await downloadFile(fileUrl, destinationPath);

