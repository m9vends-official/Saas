# Vending Security Model API

FastAPI service for camera-based security analysis in M9Vends.

It detects people with YOLOv8, describes the frame with Qwen2.5-VL through the Hugging Face router, classifies the scene with Groq/LLaMA, and returns a structured threat result.

## Run

From the repository root:

```bash
pip install -r security_detection/requirements.txt
python -m uvicorn security_detection.main:app --reload --host 0.0.0.0 --port 8001


```

Create a `.env` file with:

```env
GROQ_API_KEY=your_groq_key
HF_TOKEN=your_hugging_face_token
GROQ_MODEL=llama-3.1-8b-instant
HF_QWEN_MODEL=Qwen/Qwen2.5-VL-72B-Instruct
```

Open the interactive API docs at `http://localhost:8001/docs`.

## Real-Time Camera Test

Start the security API first:

```bash
python -m uvicorn security_detection.main:app --reload --host 0.0.0.0 --port 8001
```

In a second terminal, run the webcam tester:

```bash
python -m security_detection.realtime_camera_test --machine-id VM-001
```

It opens your webcam, shows a preview, and sends one frame to `/analyze` every 3 seconds. Press `q` in the preview window to stop.

Useful options:

```bash
python -m security_detection.realtime_camera_test --camera-index 1
python -m security_detection.realtime_camera_test --interval 5
python -m security_detection.realtime_camera_test --no-preview
```

## SaaS Backend Connection

Start this service, then start the Node backend with:

```env
SECURITY_MODEL_API_URL=http://localhost:8001
SECURITY_MODEL_TIMEOUT_MS=120000
SECURITY_FRAME_UPLOAD_LIMIT=8mb
```

The SaaS backend exposes:

- `POST /api/public/security-model/analyze`
- `GET /api/admin/security-model/health`
- `GET /api/admin/security-model/latest`

## Endpoints

- `GET /health` - service health and configuration status
- `GET /latest` - latest analyzed frame result
- `POST /analyze` - analyze one uploaded image frame

## Analyze Payload

Send `multipart/form-data`:

- `file`: jpg/png image
- `machine_id`: optional M9Vends machine ID

Example:

```bash
curl -X POST http://localhost:8001/analyze \
  -F "file=@frame.jpg" \
  -F "machine_id=VM-001"
```

Response shape:

```json
{
  "success": true,
  "data": {
    "timestamp": 1234567.89,
    "machine_id": "VM-001",
    "people_detected": 1,
    "boxes": [[10, 20, 120, 240, 0.91]],
    "scene": "1. People count: 1 ...",
    "threat": {
      "category": "PHYSICAL_ATTACK",
      "threat_level": "high",
      "detected_activity": "Kicking machine panel",
      "confidence": 94,
      "reason": "Repeated kicking = active physical attack"
    }
  }
}
```
