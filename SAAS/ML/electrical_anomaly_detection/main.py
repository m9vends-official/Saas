import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

try:
    from . import model as training
    from .inference import AnomalyDetector
    from .mqtt_bridge import MqttAnomalyBridge
except ImportError:  # Allows `uvicorn main:app` from inside anomaly_detection.
    import model as training
    from inference import AnomalyDetector
    from mqtt_bridge import MqttAnomalyBridge


detector = AnomalyDetector()
mqtt_bridge = MqttAnomalyBridge(detector)


class SensorReading(BaseModel):
    voltage: float = Field(..., description="Machine voltage reading")
    current: float = Field(..., description="Machine current reading")
    temperature: float = Field(..., description="Machine temperature reading")

    class Config:
        json_schema_extra = {
            "example": {
                "voltage": 221.5,
                "current": 6.2,
                "temperature": 38.4,
            }
        }


class BatchPredictionRequest(BaseModel):
    readings: list[SensorReading] = Field(..., min_items=1)


def _schema_to_dict(schema):
    if hasattr(schema, "model_dump"):
        return schema.model_dump()
    return schema.dict()


def _ensure_model_file():
    if os.path.exists(training.MODEL_PATH):
        return
    if not os.path.exists(training.DATA_PATH):
        raise FileNotFoundError(f"Training data not found: {training.DATA_PATH}")
    training.train()


def _prediction_or_http_error(reading):
    try:
        return detector.predict(reading)
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@asynccontextmanager
async def lifespan(app):
    model_ready = False
    try:
        _ensure_model_file()
        detector.load()
        app.state.model_startup_error = None
        model_ready = True
    except Exception as error:
        app.state.model_startup_error = str(error)

    if model_ready:
        mqtt_bridge.start()

    try:
        yield
    finally:
        mqtt_bridge.stop()


app = FastAPI(
    title="Machine Anomaly Model API",
    description="FastAPI service for training and serving the machine anomaly model.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "Machine anomaly model API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "model_loaded": detector.loaded,
        "model_exists": os.path.exists(training.MODEL_PATH),
        "startup_error": getattr(app.state, "model_startup_error", None),
        "mqtt": mqtt_bridge.status(),
    }


@app.get("/model/info")
def model_info():
    return {
        "success": True,
        "data": detector.info(),
    }


@app.get("/mqtt/status")
def mqtt_status():
    return {
        "success": True,
        "data": mqtt_bridge.status(),
    }


@app.post("/model/train")
def train_model():
    try:
        metrics = training.train()
        detector.load()
        mqtt_bridge.start()
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        ) from error

    return {
        "success": True,
        "message": "Model trained and loaded",
        "data": metrics,
    }


@app.post("/model/reload")
def reload_model():
    try:
        detector.load()
        mqtt_bridge.start()
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(error),
        ) from error

    return {
        "success": True,
        "message": "Model reloaded",
        "data": detector.info(),
    }


@app.post("/model/reset-state")
def reset_model_state():
    detector.reset_state()
    return {
        "success": True,
        "message": "Model state reset",
        "data": detector.info(),
    }


@app.post("/predict")
def predict(reading: SensorReading):
    result = _prediction_or_http_error(_schema_to_dict(reading))
    return {
        "success": True,
        "data": result,
    }


@app.post("/predict/batch")
def predict_batch(request: BatchPredictionRequest):
    results = [
        _prediction_or_http_error(_schema_to_dict(reading))
        for reading in request.readings
    ]
    return {
        "success": True,
        "count": len(results),
        "data": results,
    }
