import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendRoot = path.resolve(__dirname, '..');
const wasmDestDir = path.join(frontendRoot, 'public', 'wasm');
const modelsDestDir = path.join(frontendRoot, 'public', 'models');

// Create directories if they don't exist
fs.mkdirSync(wasmDestDir, { recursive: true });
fs.mkdirSync(modelsDestDir, { recursive: true });

console.log('Copying MediaPipe WASM assets...');
const wasmSrcDir = path.join(frontendRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');

if (fs.existsSync(wasmSrcDir)) {
  const files = fs.readdirSync(wasmSrcDir);
  for (const file of files) {
    const srcPath = path.join(wasmSrcDir, file);
    const destPath = path.join(wasmDestDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to public/wasm/`);
  }
} else {
  console.warn(`Warning: MediaPipe WASM source directory not found at ${wasmSrcDir}`);
}

console.log('Downloading face_landmarker.task model...');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const modelDestPath = path.join(modelsDestDir, 'face_landmarker.task');

const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download model: HTTP status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Model downloaded successfully to public/models/face_landmarker.task');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
};

download(modelUrl, modelDestPath)
  .then(() => {
    console.log('AR asset localization complete!');
  })
  .catch((err) => {
    console.error('Error downloading model:', err.message);
    process.exit(1);
  });
