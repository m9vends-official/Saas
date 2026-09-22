# Machine Anomaly Model API

FastAPI service for training and serving the machine anomaly detection model.

## Run

From the repository root:

```bash
pip install -r anomaly_detection/requirements.txt
python -m uvicorn anomaly_detection.main:app --reload --host 0.0.0.0 --port 8000
```

Open the interactive API docs at `http://localhost:8000/docs`.

## SaaS Backend Connection

Start this service first, then start the Node backend with:

```bash
ML_MODEL_API_URL=http://localhost:8000
ML_MODEL_TIMEOUT_MS=5000
```

The SaaS backend exposes this model through:

- `POST /api/public/machine-model/predict`
- `POST /api/public/machine-model/predict/batch`
- `GET /api/admin/machine-model/health`
- `GET /api/admin/machine-model/info`
- `POST /api/admin/machine-model/train`
- `POST /api/admin/machine-model/reload`
- `POST /api/admin/machine-model/reset-state`

## Endpoints

- `GET /health` - service and model load status
- `GET /model/info` - model path, features, threshold, and state
- `POST /model/train` - train the model from `electric_anomaly.csv` and reload it
- `POST /model/reload` - reload `anomaly_model.pkl` from disk
- `POST /model/reset-state` - reset consecutive anomaly state
- `POST /predict` - predict one machine reading
- `POST /predict/batch` - predict multiple machine readings

## Prediction Payload

```json
{
  "voltage": 221.5,
  "current": 6.2,
  "temperature": 38.4
}
```
