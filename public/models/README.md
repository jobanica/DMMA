# face-api.js models

These are the on-device face-recognition weights loaded at runtime by
`src/lib/face/faceApiProvider.js` (`/models/*`). They are **committed to the
repo** (~7 MB total) so the app self-hosts them — no external CDN at runtime,
and the PWA can cache them offline (see `vite.config.js` runtime caching).

Nets included:
- `tinyFaceDetector` — fast face detection
- `faceLandmark68Net` — landmarks (blink / head-turn liveness)
- `faceRecognitionNet` — 128-d descriptor for 1:1 matching
- `faceExpressionNet` — smile detection for the "smile" liveness action

To refresh them from upstream:

```bash
BASE=https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights
for f in \
  tiny_face_detector_model-weights_manifest.json tiny_face_detector_model-shard1 \
  face_landmark_68_model-weights_manifest.json face_landmark_68_model-shard1 \
  face_recognition_model-weights_manifest.json face_recognition_model-shard1 face_recognition_model-shard2 \
  face_expression_model-weights_manifest.json face_expression_model-shard1 ; do
  curl -fsSL "$BASE/$f" -o "public/models/$f"
done
```
