import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ARTrackedFrame, ARFrameConfig, ARTransform, ARUserAdjust, FaceLandmark } from "./types";
import { captureCompositeFrame, createProceduralGlasses, createHeadOccluder, prepareModelForShadows } from "./glassesGeometry";
import { enhanceGlbMaterials } from "./enhanceGlbMaterials";
import { applyVideoCover, videoPixelRatio, toViewportPoint, facePointToWorld, type FaceProjection, wrapFrameModel, disposeModel, estimateFaceLighting } from "./arRendering";
import { PoseFilter } from "./oneEuroFilter";
import { createFaceOcclusion } from "./faceOcclusion";

interface ARTryOnCanvasProps {
  stream: MediaStream | null;
  frame: ARFrameConfig;
  transform: ARTransform | null;
  landmarks?: FaceLandmark[] | null;
  /** High-frequency landmarks stream — preferred over `landmarks` for tracking. */
  landmarksRef?: { current: FaceLandmark[] | null };
  sourceVideoRef?: { current: HTMLVideoElement | null };
  trackedFrameRef?: { current: ARTrackedFrame | null };
  userAdjust?: ARUserAdjust;
  userPdMm?: number | null;
  onCaptureReady: (capture: (() => string | null) | null) => void;
  /** Loaded is emitted after the GLB replaces the fallback and a render has completed. */
  onModelLoad?: (result: { url: string; status: "loaded" | "error" }) => void;
  showOverlay?: boolean;
}

interface ARTransform3D {
  projection: FaceProjection;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  scale: [number, number, number];
}

// ── Pooled temporaries for calculateGlassesTransform3D (avoid per-frame allocation) ──
const _pool = {
  L: new THREE.Vector3(),
  R: new THREE.Vector3(),
  B: new THREE.Vector3(),
  N: new THREE.Vector3(),
  dirX: new THREE.Vector3(),
  dirYTemp: new THREE.Vector3(),
  dirZ: new THREE.Vector3(),
  dirY: new THREE.Vector3(),
  rotMatrix: new THREE.Matrix4(),
  quat: new THREE.Quaternion(),
};

function midpoint(a: FaceLandmark, b: FaceLandmark): FaceLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
}

export function calculateGlassesTransform3D(
  landmarks: FaceLandmark[],
  aspect: number,
  videoAspect: number,
  lensCenterDistanceMm: number,
  userPdMm: number,
  fov: number,
  cameraZ: number
): ARTransform3D | null {
  const LEFT_EYE_OUTER = 33;
  const LEFT_EYE_INNER = 133;
  const RIGHT_EYE_OUTER = 263;
  const RIGHT_EYE_INNER = 362;
  const LEFT_IRIS = 468;
  const RIGHT_IRIS = 473;
  const NOSE_BRIDGE = 168;
  const NOSE_TIP = 1;

  const leftOuter = landmarks[LEFT_EYE_OUTER];
  const leftInner = landmarks[LEFT_EYE_INNER];
  const rightOuter = landmarks[RIGHT_EYE_OUTER];
  const rightInner = landmarks[RIGHT_EYE_INNER];
  const leftIris = landmarks[LEFT_IRIS];
  const rightIris = landmarks[RIGHT_IRIS];
  const lmLeft = leftIris && Number.isFinite(leftIris.x) && Number.isFinite(leftIris.y)
    ? leftIris
    : leftOuter && leftInner
      ? midpoint(leftOuter, leftInner)
      : leftOuter ?? null;
  const lmRight = rightIris && Number.isFinite(rightIris.x) && Number.isFinite(rightIris.y)
    ? rightIris
    : rightOuter && rightInner
      ? midpoint(rightOuter, rightInner)
      : rightOuter ?? null;
  const lmBridge = landmarks[NOSE_BRIDGE];
  const lmNose = landmarks[NOSE_TIP];

  if (!lmLeft || !lmRight || !lmBridge || !lmNose) {
    return null;
  }

  const [leftX, leftY] = toViewportPoint(lmLeft, videoAspect, aspect);
  const [rightX, rightY] = toViewportPoint(lmRight, videoAspect, aspect);

  const eyeDistScreen = Math.hypot(rightX - leftX, rightY - leftY);
  if (eyeDistScreen < 0.02) {
    return null;
  }

  // Soft rejection of extreme distances — keeps scale in a believable range
  const D = Math.max(0.75, Math.min(2.6, 0.165 / eyeDistScreen));
  const Z_face = cameraZ - D;

  const frustumHeight = 2 * Math.tan((fov / 2) * Math.PI / 180) * D;
  const frustumWidth = frustumHeight * aspect;
  // MediaPipe z uses the full input image width, including portions cropped by cover.
  const projection = {
    width: frustumWidth, height: frustumHeight, z: Z_face, cameraZ,
    depthScale: frustumWidth * Math.max(1, videoAspect / aspect),
  };

  const { L, R, B, N, dirX, dirYTemp, dirZ, dirY, rotMatrix, quat } = _pool;

  facePointToWorld(lmLeft, projection, videoAspect, aspect, L);
  facePointToWorld(lmRight, projection, videoAspect, aspect, R);
  facePointToWorld(lmBridge, projection, videoAspect, aspect, B);
  facePointToWorld(lmNose, projection, videoAspect, aspect, N);

  dirX.copy(R).sub(L).normalize();
  dirYTemp.copy(B).sub(N).normalize();
  dirZ.copy(dirX).cross(dirYTemp).normalize();
  dirY.copy(dirZ).cross(dirX).normalize();

  rotMatrix.makeBasis(dirX, dirY, dirZ);
  quat.setFromRotationMatrix(rotMatrix);

  const eyeDistWorld = L.distanceTo(R);
  const scaleVal = eyeDistWorld * (lensCenterDistanceMm / (userPdMm * 0.48));

  return {
    projection,
    position: [B.x, B.y, B.z],
    quaternion: quat.clone(),
    scale: [scaleVal, scaleVal, scaleVal],
  };
}

export function ARTryOnCanvas({
  stream,
  frame,
  transform,
  landmarks,
  landmarksRef,
  sourceVideoRef,
  trackedFrameRef,
  userAdjust,
  userPdMm,
  onCaptureReady,
  onModelLoad,
  showOverlay = true,
}: ARTryOnCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = sourceVideoRef ?? localVideoRef;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const targetPos = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  const hasTransform = useRef(false);
  const adjustRef = useRef<ARUserAdjust>({ x: 0, y: 0, scale: 1 });
  const landmarksMirror = useRef<FaceLandmark[] | null>(null);
  const overlayRef = useRef(showOverlay);
  const pdRef = useRef(userPdMm);
  pdRef.current = userPdMm;
  const transformMirror = useRef<ARTransform | null>(null);

  const onCaptureReadyRef = useRef(onCaptureReady);
  const onModelLoadRef = useRef(onModelLoad);
  onModelLoadRef.current = onModelLoad;
  useEffect(() => {
    onCaptureReadyRef.current = onCaptureReady;
  }, [onCaptureReady]);

  useEffect(() => {
    adjustRef.current = userAdjust ?? { x: 0, y: 0, scale: 1 };
  }, [userAdjust]);

  useEffect(() => {
    landmarksMirror.current = landmarks ?? null;
  }, [landmarks]);

  useEffect(() => {
    transformMirror.current = transform;
  }, [transform]);

  useEffect(() => {
    overlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    if (sourceVideoRef) return;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, sourceVideoRef, videoRef]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!root || !canvas || !video) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.transmissionResolutionScale = 0.5;
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.generateMipmaps = false;
    scene.background = videoTexture;
    let trackedTexture: THREE.CanvasTexture | null = null;
    let textureWidth = 0;
    let textureHeight = 0;
    let renderedFrame: ARTrackedFrame | null = null;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 2.8;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(room, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.9;
    room.dispose();
    pmremGenerator.dispose();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1);
    keyLight.position.set(1.5, 2.5, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 512;
    keyLight.shadow.mapSize.height = 512;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.radius = 2.5;
    keyLight.shadow.camera.left = -0.5;
    keyLight.shadow.camera.right = 0.5;
    keyLight.shadow.camera.top = 0.5;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 6.0;
    keyLight.shadow.camera.updateProjectionMatrix();
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 1.5, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 2.5, -2);
    scene.add(rimLight);

    const glassesGroup = new THREE.Group();
    glassesGroup.visible = false;
    scene.add(glassesGroup);

    const headOccluder = createHeadOccluder();
    glassesGroup.add(headOccluder);
    const faceOcclusion = createFaceOcclusion();
    scene.add(faceOcclusion.group);
    const poseFilter = new PoseFilter();
    hasTransform.current = false;
    let activeModel = createProceduralGlasses(frame);
    prepareModelForShadows(activeModel);
    glassesGroup.add(activeModel);

    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    let isDisposed = false;
    let modelReadyPending = false;

    if (frame.modelUrl) {
      gltfLoader.load(
        frame.modelUrl,
        (gltf) => {
          if (isDisposed) {
            disposeModel(gltf.scene, true);
            return;
          }
          glassesGroup.remove(activeModel);
          disposeModel(activeModel, true);
          enhanceGlbMaterials(gltf.scene, frame);
          activeModel = wrapFrameModel(gltf.scene, frame);
          prepareModelForShadows(activeModel);
          glassesGroup.add(activeModel);
          modelReadyPending = true;
        },
        undefined,
        (error) => {
          if (isDisposed) return;
          onModelLoadRef.current?.({ url: frame.modelUrl!, status: "error" });
          if (import.meta.env.DEV) console.warn("AR frame GLB failed to load", frame.modelUrl, error);
        }
      );
    }

    let lastWidth = 0;
    let lastHeight = 0;
    let lastVideoWidth = 0;
    let lastVideoHeight = 0;
    let lastDpr = 0;
    let projectionChanged = true;
    const resize = () => {
      const bounds = root.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      const source = trackedFrameRef?.current?.image;
      const sourceWidth = source?.width ?? video.videoWidth;
      const sourceHeight = source?.height ?? video.videoHeight;
      if (width === lastWidth && height === lastHeight && sourceWidth === lastVideoWidth && sourceHeight === lastVideoHeight && window.devicePixelRatio === lastDpr) {
        return;
      }
      lastWidth = width;
      lastHeight = height;
      lastVideoWidth = sourceWidth;
      lastVideoHeight = sourceHeight;
      lastDpr = window.devicePixelRatio;
      projectionChanged = true;
      renderer.setPixelRatio(videoPixelRatio(lastVideoWidth, lastVideoHeight, width, height, lastDpr));
      const aspect = lastVideoWidth && lastVideoHeight ? lastVideoWidth / lastVideoHeight : width / height;
      applyVideoCover(videoTexture, aspect, width / height);
      if (trackedTexture) applyVideoCover(trackedTexture, aspect, width / height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    video.addEventListener("loadedmetadata", resize);

    // ── Pooled temporaries for applyTracking (reused every frame) ──
    const _localOffset = new THREE.Vector3();
    const _localRot = new THREE.Euler();
    const _localQuat = new THREE.Quaternion();
    const _fallbackEuler = new THREE.Euler();

    const applyTracking = () => {
      faceOcclusion.group.visible = false;
      headOccluder.visible = true;
      const sourceLandmarks = trackedFrameRef ? trackedFrameRef.current?.landmarks : landmarksRef ? landmarksRef.current : landmarksMirror.current;
      if (sourceLandmarks && sourceLandmarks.length > 0) {
        const aspect = lastWidth / Math.max(lastHeight, 1);
        const videoAspect = lastVideoWidth && lastVideoHeight ? lastVideoWidth / lastVideoHeight : aspect;
        const transform3D = calculateGlassesTransform3D(
          sourceLandmarks,
          aspect,
          videoAspect,
          frame.lensCenterDistanceMm ?? 71,
          pdRef.current ?? 63,
          35,
          2.8
        );
        if (transform3D) {
          headOccluder.visible = !faceOcclusion.update(sourceLandmarks, transform3D.projection,
            videoAspect, aspect, transform3D.quaternion,
            transform3D.scale[0] * 0.48 / (frame.lensCenterDistanceMm ?? 71));
          const offset = frame.transformOffset;
          const adjust = adjustRef.current;
          _localOffset.set(
            offset.position[0] * transform3D.scale[0],
            offset.position[1] * transform3D.scale[1],
            offset.position[2] * transform3D.scale[2]
          );
          _localOffset.applyQuaternion(transform3D.quaternion);

          targetPos.current.set(
            transform3D.position[0] + _localOffset.x + adjust.x * transform3D.scale[0],
            transform3D.position[1] + _localOffset.y + adjust.y * transform3D.scale[1],
            transform3D.position[2] + _localOffset.z
          );

          _localRot.set(
            offset.rotation[0],
            offset.rotation[1],
            offset.rotation[2],
            "XYZ"
          );
          _localQuat.setFromEuler(_localRot);
          targetQuat.current.copy(transform3D.quaternion).multiply(_localQuat);

          const userScale = offset.scale * adjust.scale;
          targetScale.current.set(
            transform3D.scale[0] * userScale,
            transform3D.scale[1] * userScale,
            transform3D.scale[2] * userScale
          );
          hasTransform.current = true;
          return;
        }
      }

      const fallback = trackedFrameRef || landmarksRef ? null : transformMirror.current;
      if (!fallback) {
        hasTransform.current = false;
        return;
      }

      const offset = frame.transformOffset;
      const adjust = adjustRef.current;
      targetPos.current.set(
        fallback.position[0] + offset.position[0] + adjust.x,
        fallback.position[1] + offset.position[1] + adjust.y,
        fallback.position[2] + offset.position[2]
      );
      _fallbackEuler.set(
        fallback.rotation[0] + offset.rotation[0],
        fallback.rotation[1] + offset.rotation[1],
        fallback.rotation[2] + offset.rotation[2],
        "XYZ"
      );
      targetQuat.current.setFromEuler(_fallbackEuler);
      targetScale.current.setScalar(fallback.scale[0] * offset.scale * adjust.scale);
      hasTransform.current = true;
    };

    let frameId = 0;
    let paused = false;

    const onVisibilityChange = () => {
      paused = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const lightCanvas = document.createElement("canvas");
    lightCanvas.width = 64;
    lightCanvas.height = 48;
    const lightContext = lightCanvas.getContext("2d", { willReadFrequently: true });
    let lastLightSample = -Infinity;
    let lastLandmarks: FaceLandmark[] | null = null;
    let lastFallback: ARTransform | null = null;
    let lastAdjust: ARUserAdjust | null = null;
    let lastPd: number | null | undefined;
    const renderFrame = (timestamp = performance.now()) => {
      if (!paused) {
        const trackedFrame = trackedFrameRef?.current ?? null;
        if (trackedFrame && trackedFrame !== renderedFrame) {
          if (!trackedTexture ||
              textureWidth !== trackedFrame.image.width || textureHeight !== trackedFrame.image.height) {
            trackedTexture?.dispose();
            trackedTexture = new THREE.CanvasTexture(trackedFrame.image);
            trackedTexture.colorSpace = THREE.SRGBColorSpace;
            trackedTexture.minFilter = THREE.LinearFilter;
            trackedTexture.generateMipmaps = false;
            textureWidth = trackedFrame.image.width;
            textureHeight = trackedFrame.image.height;
            projectionChanged = true;
            applyVideoCover(trackedTexture, textureWidth / textureHeight, camera.aspect);
          }
          trackedTexture.image = trackedFrame.image;
          trackedTexture.needsUpdate = true;
        }
        scene.background = trackedFrame && trackedTexture ? trackedTexture : videoTexture;
        resize();
        const source = trackedFrameRef ? trackedFrame?.landmarks ?? null : landmarksRef ? landmarksRef.current : landmarksMirror.current;
        // Filter once per new tracking result; repeated display frames must not bias velocity.
        if (trackedFrame !== renderedFrame || source !== lastLandmarks || (!trackedFrameRef && !landmarksRef && transformMirror.current !== lastFallback) ||
            adjustRef.current !== lastAdjust || pdRef.current !== lastPd || projectionChanged || !hasTransform.current) {
          applyTracking();
          if (hasTransform.current) {
            poseFilter.apply(glassesGroup, targetPos.current, targetQuat.current, targetScale.current, trackedFrame?.timestampMs ?? timestamp);
          } else {
            poseFilter.reset();
          }
          lastLandmarks = source;
          lastFallback = transformMirror.current;
          lastAdjust = adjustRef.current;
          lastPd = pdRef.current;
          projectionChanged = false;
        }
        renderedFrame = trackedFrame;
        glassesGroup.visible = overlayRef.current && hasTransform.current;
        faceOcclusion.group.visible = glassesGroup.visible && !headOccluder.visible;
        if (lightContext && source && (trackedFrame || video.readyState >= 2) && timestamp - lastLightSample >= 200) {
          lastLightSample = timestamp;
          lightContext.drawImage(trackedFrame?.image ?? video, 0, 0, 64, 48);
          const lighting = estimateFaceLighting(lightContext.getImageData(0, 0, 64, 48).data, 64, 48, source);
          if (lighting) {
            renderer.toneMappingExposure += (lighting.exposure - renderer.toneMappingExposure) * 0.1;
            keyLight.color.lerp(lighting.color, 0.1);
            ambientLight.color.lerp(lighting.color, 0.1);
            keyLight.position.x += (lighting.direction * 3 - keyLight.position.x) * 0.1;
          }
        }
        renderer.render(scene, camera);
        if (modelReadyPending) {
          modelReadyPending = false;
          onModelLoadRef.current?.({ url: frame.modelUrl!, status: "loaded" });
        }
      }
      frameId = window.requestAnimationFrame(renderFrame);
    };

    onCaptureReadyRef.current?.(() => renderedFrame || video.readyState >= 2 ? captureCompositeFrame(canvas) : null);
    renderFrame();

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      onCaptureReadyRef.current?.(null);
      isDisposed = true;
      scene.remove(glassesGroup);
      disposeModel(glassesGroup, true);
      disposeModel(faceOcclusion.group);
      video.removeEventListener("loadedmetadata", resize);
      videoTexture.dispose();
      trackedTexture?.dispose();
      keyLight.shadow.dispose();
      envRT?.dispose?.();
      renderer.dispose();
    };
    // userAdjust / landmarks / transform / showOverlay / onCaptureReady are read via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, landmarksRef, sourceVideoRef, trackedFrameRef]);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-[#0b1220]">
      {!sourceVideoRef && <video
        ref={videoRef}
        data-testid="ar-video-layer"
        className="absolute inset-0 h-full w-full object-cover opacity-0 pointer-events-none"
        autoPlay
        muted
        playsInline
      />}
      <canvas
        ref={canvasRef}
        data-testid="ar-canvas-layer"
        className="absolute inset-0 h-full w-full scale-x-[-1]"
      />
    </div>
  );
}
