# face-api.js models

The on-device face matcher (`src/lib/face/faceApiProvider.js`) loads its
weights from this folder at runtime (`/models/*`). The model shards are large
binaries and are intentionally **not** committed (see `.gitignore`).

Download them once into this directory before running the app:

```bash
# from the repo root
BASE=https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights
for f in \
  tiny_face_detector_model-weights_manifest.json \
  tiny_face_detector_model-shard1 \
  face_landmark_68_model-weights_manifest.json \
  face_landmark_68_model-shard1 \
  face_recognition_model-weights_manifest.json \
  face_recognition_model-shard1 \
  face_recognition_model-shard2 \
  face_expression_model-weights_manifest.json \
  face_expression_model-shard1 ; do
  curl -fsSL "$BASE/$f" -o "public/models/$f"
done
```

These four nets are required:
- `tinyFaceDetector` — fast face detection
- `faceLandmark68Net` — landmarks (used for blink / head-turn liveness)
- `faceRecognitionNet` — 128-d descriptor for 1:1 matching
- `faceExpressionNet` — smile detection for the "smile" liveness action
