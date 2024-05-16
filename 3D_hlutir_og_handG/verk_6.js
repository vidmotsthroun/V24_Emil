import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let gestureRecognizer;
let runningMode = 'IMAGE';
let enableWebcamButton;
let webcamRunning = false;

const videoHeight = '200px';
const videoWidth = '240px';

const createGestureRecognizer = async () => {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
          delegate: 'GPU'
      },
      runningMode: runningMode
  });
};
createGestureRecognizer();
const video = document.getElementById('webcam');

enableWebcamButton = document.getElementById('webcamButton');
enableWebcamButton.addEventListener('click', enableCam);

// Fall til að kveikja/slökkva á vefmyndavél og byrja gesture recognition
function enableCam(event) {
  if (!gestureRecognizer) {
      alert('Please wait for gestureRecognizer to load');
      return;
  }
  // Tjékkar ef að vefmyndavélin er nú þegar í gangi áður en það kveikir/slökkvir
  if (webcamRunning === true) {
      webcamRunning = false;
  }
  else {
      webcamRunning = true;
  }
  // „getUsermedia“ stiki
  const constraints = {
      video: true
  };
  // Ná í myndbandsstraum vefmyndavélarinnar
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      video.srcObject = stream;
      video.addEventListener('loadeddata', predictWebcam);
  });
}
let lastVideoTime = -1;
let results = undefined;
// Fall til að greina gestures í myndbandsstraums vefmyndavélarinnar
async function predictWebcam() {
  const webcamElement = document.getElementById('webcam');
  if (runningMode === 'IMAGE') {
      runningMode = 'VIDEO';
      await gestureRecognizer.setOptions({ runningMode: 'VIDEO' });
  }

  let nowInMs = Date.now();

  if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      results = gestureRecognizer.recognizeForVideo(video, nowInMs);
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  // Teiknar landmark og tengingar á frálags-canvas
  const drawingUtils = new DrawingUtils(canvasCtx);
  canvasElement.style.height = videoHeight;
  webcamElement.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  webcamElement.style.width = videoWidth;

  if (results.landmarks) {
      for (const landmarks of results.landmarks) {
          drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
              color: '#00FF00',
              lineWidth: 5
          });
          drawingUtils.drawLandmarks(landmarks, {
              color: '#FF0000',
              lineWidth: 2
          });
      }
  }

  canvasCtx.restore();
  // Byrtir gesture frálagsgögn
  if (results.gestures.length > 0) {
      gestureOutput.style.display = 'block'; // Myndavélastraum stíll
      gestureOutput.style.width = videoWidth; // Myndavélastraum breydd
      gestureOutput.innerText = results.gestures[0][0].categoryName; // Gesture úttaksheiti

      parseFloat(xOutput.innerText = results.landmarks[0][0].x.toFixed(2)); // Gesture X gildi
      parseFloat(yOutput.innerText = results.landmarks[0][0].y.toFixed(2)); // Gesture Y gildi

      console.log(gestureOutput.innerText)
  }
  else {
      gestureOutput.style.display = 'none';
  }
  // Kallar á „predictWebcam“ endurkvæmt, til að halda áfram að greina gestures
  if (webcamRunning === true) {
      window.requestAnimationFrame(predictWebcam);
  }
}

document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(4, 5, 15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.5;
controls.autoRotate = false;
controls.target = new THREE.Vector3(0, 1, 0);
controls.update();

const groundGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x555555,
  side: THREE.DoubleSide
});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.castShadow = false;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const spotLight = new THREE.SpotLight(0x101010, 3000, 100, 0.22, 1);
spotLight.position.set(0, 50, 0);
spotLight.castShadow = true;
spotLight.shadow.bias = -0.0001;
scene.add(spotLight);

let mesh;

const loader = new GLTFLoader().setPath('gltf/bolti/');
loader.load('scene.glb', (gltf) => {
  console.log('loading model');
  const mesh = gltf.scene;

  mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  mesh.position.set(0, 1, -1);
  scene.add(mesh);

  document.getElementById('progress-container').style.display = 'none';
}, (xhr) => {
  console.log(`loading ${xhr.loaded / xhr.total * 100}%`);
}, (error) => {
  console.error(error);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  if (results && results.gestures.length > 0) {
    if (results.gestures[0][0].categoryName === "Thumb_Up") {
      mesh.position.y += 0.01;
    } else if (results.gestures[0][0].categoryName === "Thumb_Down") {
        mesh.position.y -= 0.01;
    }
    // ______________________________Y______________________________
    if (results.gestures[0][0].categoryName === "Victory") {
        mesh.position.x += 0.01;
    } else if (results.gestures[0][0].categoryName === "ILoveYou") {
        mesh.position.x -= 0.01;
    }
    // ______________________________scale______________________________
    if (results.gestures[0][0].categoryName === "Open_Palm") {
        mesh.scale.x += 0.01;
        mesh.scale.y += 0.01;
        mesh.scale.z += 0.01;
    } else if (results.gestures[0][0].categoryName === "Closed_Fist") {
        mesh.scale.x += 0.01;
        mesh.scale.y += 0.01;
        mesh.scale.z += 0.01;
    }
  }

  renderer.render(scene, camera);
}

animate();