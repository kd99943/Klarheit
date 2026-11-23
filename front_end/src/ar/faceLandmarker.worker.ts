import { createFaceLandmarker } from "./faceLandmarker";
import type { TrackingWorkerRequest, TrackingWorkerResponse } from "./trackingDetector";

const send = (message: TrackingWorkerResponse) => self.postMessage(message);
void createFaceLandmarker().then((detector) => {
  self.onmessage = (event: MessageEvent<TrackingWorkerRequest>) => {
    const { image, timestampMs } = event.data;
    try {
      const result = detector.detectForVideo(image, timestampMs);
      send({ type: "result", result });
    } catch (error) {
      send({ type: "error", message: String(error) });
    } finally {
      image.close();
    }
  };
  send({ type: "ready" });
}).catch((error) => send({ type: "error", message: String(error) }));
