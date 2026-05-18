# Phase 2 WebAR Try-On Design

Date: 2026-05-18
Status: Approved for implementation planning

## Goal

Phase 2 upgrades Klarheit's AR Virtual Studio from a static brand scene into a real browser-based try-on workspace. The first implementation milestone uses the self-owned route: MediaPipe Face Landmarker for face tracking and Three.js for rendering glasses over the live camera feed.

This milestone creates production-grade AR infrastructure, not a final polished commercial model library. It must support real camera input, live face tracking, 3D overlay rendering, product/finish switching, screenshot capture, and robust fallback states. Final product-specific `.glb` assets, broad device QA, analytics, and launch hardening belong to the next milestone.

## Non-Goals

- No third-party try-on SDK.
- No payment or checkout changes.
- No backend schema changes.
- No requirement to ship final calibrated `.glb` models for all 4 products in this milestone.
- No promise of full device matrix certification before the AR foundation is complete.

## Current State

The current AR page is `front_end/src/pages/ARVirtualStudio.tsx`. It presents a premium static UI with mock tracking readouts, color selectors, screenshot feedback, and a link to Config Lab. It does not currently request camera permission, run face detection, create a Three.js scene, render a live overlay, or handle real tracking errors.

The new work should preserve the existing premium brand direction and route structure while replacing mocked AR state with real browser/device state.

## Architecture

The implementation stays frontend-only for this phase and introduces a small AR module under `front_end/src/ar/`.

### `useCameraStream`

Responsibilities:

- Request the user's camera with front-facing constraints.
- Expose the active `MediaStream`, permission/loading state, and user-facing error state.
- Stop all tracks on unmount or when the AR session is reset.
- Detect unsupported browser APIs such as missing `navigator.mediaDevices.getUserMedia`.

Public shape:

```ts
type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error";
```

### `useFaceLandmarks`

Responsibilities:

- Load and own the MediaPipe Face Landmarker instance.
- Run landmark detection against the current video frame.
- Expose landmarks, confidence/quality state, and lifecycle state.
- Clean up workers/resources where the MediaPipe API supports it.

The hook should isolate MediaPipe-specific imports so the AR page does not depend directly on the library's API surface.

Public shape:

```ts
type TrackingStatus = "initializing" | "tracking" | "no-face" | "low-confidence" | "error";
```

### `arCalibration`

Responsibilities:

- Convert MediaPipe face landmarks into a stable glasses transform.
- Use eye landmarks and nose bridge landmarks as anchors.
- Return position, rotation, scale, and a normalized confidence value.
- Keep the math testable as pure functions.

This module is the most important test target because tracking quality depends on it and it is independent from browser camera APIs.

### `ArTryOnCanvas`

Responsibilities:

- Render a full-bleed AR scene with Three.js.
- Use the live video as the scene background or a synced video layer.
- Load the selected glasses model or fallback geometry.
- Apply transforms from `arCalibration`.
- Resize cleanly across mobile and desktop viewports.
- Expose screenshot capture through a controlled callback.
- Dispose geometries, materials, renderers, animation frames, and media references on unmount.

### `frameCatalog`

Responsibilities:

- Map Klarheit products/finishes to AR render configuration.
- Define display name, finish color, lens tint, model URL, fallback geometry options, and transform offsets.
- Allow final `.glb` product models to replace placeholder assets without rewriting page logic.

First milestone behavior:

- If no final `.glb` model exists, use a calibrated lightweight placeholder frame or generated Three.js frame geometry.
- Keep product-specific transform offsets in data, not hardcoded inside rendering logic.

### `ARVirtualStudio`

Responsibilities:

- Coordinate camera, tracking, selected finish/product, capture state, and fallback state.
- Preserve the existing navigation path `/virtual-studio`.
- Replace mock readouts with real state where available.
- Keep the Config Lab transition available in all nonfatal states.
- Present clear permission and unsupported-browser states.

## User Flow

1. User opens AR Studio.
2. Page checks browser support and asks for camera permission.
3. Camera stream starts and video is attached to the AR renderer.
4. Face Landmarker initializes.
5. When a face is detected, `arCalibration` computes glasses position, rotation, and scale.
6. `ArTryOnCanvas` renders the selected frame over the live camera feed.
7. User switches finish/product and the render configuration updates without page reload.
8. User captures a still image from the AR canvas.
9. User continues to Config Lab with the selected product context where available.

## State Model

The AR page should distinguish these states:

- `initializing`: camera or model resources are loading.
- `permission-denied`: user denied camera access.
- `unsupported`: browser cannot provide required camera APIs.
- `tracking`: face detected and glasses overlay is active.
- `no-face`: camera works but no usable face is visible.
- `low-confidence`: landmarks exist but confidence is too low for stable overlay.
- `captured`: screenshot was generated.
- `error`: unexpected failure in camera, MediaPipe, model loading, or renderer setup.

The UI should not claim live AR tracking unless the system is actually in the `tracking` state.

## Fallback Behavior

Fallback is part of the product, not an afterthought.

- If camera access is denied, show a static product preview and keep Config Lab accessible.
- If the browser is unsupported, explain that live try-on requires a modern camera-capable browser.
- If MediaPipe fails to initialize, keep product/finish selection available and show a non-live preview.
- If no face is detected, keep the live camera visible and guide the user through concise status copy.

## Asset Strategy

This milestone can ship with placeholder 3D glasses assets or procedural frame geometry, as long as the rendering, calibration, switching, and cleanup architecture is real. Final `.glb` files should follow these constraints when added:

- One consistent coordinate system across all products.
- Known optical center and bridge anchor.
- Compressed web-friendly file size.
- Product-specific offsets stored in `frameCatalog`.
- Lazy loading so AR startup is not blocked by all models.

## Testing Strategy

Use TDD for production code in this phase.

Required tests:

- `arCalibration` computes a stable transform from representative landmarks.
- `arCalibration` rejects insufficient or malformed landmark input.
- `useCameraStream` handles unsupported APIs, permission denial, ready stream, and track cleanup.
- `ARVirtualStudio` renders distinct UI states for tracking, denied, unsupported, and fallback paths.
- Product/finish selection updates render configuration without navigation.

Tests should avoid real cameras and real MediaPipe workers. Browser/device behavior should be isolated behind hooks and adapter functions so unit tests can use controlled fakes.

## Acceptance Criteria

- AR Studio requests camera permission and starts a live stream in supported browsers.
- Face tracking runs through MediaPipe Face Landmarker.
- A Three.js glasses overlay follows the face using computed landmarks.
- Finish/product switching updates the rendered frame without full page reload.
- Screenshot capture produces a still image from the AR view.
- Denied camera, unsupported browser, no-face, and tracking-error states are handled.
- Unit tests cover calibration logic and key state transitions.
- Existing frontend tests and TypeScript lint pass.

## Risks

- Visual realism depends heavily on model quality and calibration offsets.
- Mobile browser performance may require additional tuning after the foundation exists.
- MediaPipe package size may affect initial load and should be lazy-loaded.
- Browser camera permissions vary across desktop, Android Chrome, and iOS Safari.

## Implementation Notes

- Prefer lazy imports for MediaPipe and Three.js to keep the initial app bundle reasonable.
- Keep the Three.js scene full-bleed and visually integrated with the existing AR page.
- Do not introduce backend dependencies for AR state in this milestone.
- Do not hardcode final product calibration into render code; store per-product offsets as data.
- Keep the existing premium interface language, but make status copy truthful to actual runtime state.
