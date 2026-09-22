import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status

from .config import runtime_config_status
from .logger import get_logger
from .pipeline import VendingSecurityPipeline

log = get_logger(__name__)
app = FastAPI(
    title="Vending Security Model API",
    description="Detects people, describes a camera frame, and classifies vending-machine threats.",
    version="1.0.0",
)
pipeline = VendingSecurityPipeline()

_latest_result = {"status": "no frames processed yet"}


@app.get("/")
def root():
    return {
        "success": True,
        "message": "Vending security model API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "ok",
        "configured": runtime_config_status(),
    }


@app.get("/latest")
def latest():
    return {
        "success": True,
        "data": _latest_result,
    }


@app.post("/capture")
async def capture(request: Request):
    device_id = request.query_params.get("deviceID") or request.query_params.get("device") or "unknown-device"

    content_type = request.headers.get("content-type", "")
    if "image/jpeg" not in content_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Expected image/jpeg",
        )

    image_data = await request.body()
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image body",
        )

    npimg = np.frombuffer(image_data, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode JPEG image",
        )

    result = pipeline.process_frame(frame)
    result["boxes"] = [list(box) for box in result["boxes"]]
    result["machine_id"] = device_id
    result["device_id"] = device_id

    global _latest_result
    _latest_result = result
    log.info(
        "Captured & analyzed security frame for deviceID=%s threat_level=%s",
        device_id,
        result["threat"].get("threat_level"),
    )
    return {
        "success": True,
        "data": result,
    }


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    machine_id: str | None = Form(default=None),
):
    """Accept a jpg/png frame and return the threat analysis."""
    global _latest_result

    contents = await file.read()
    npimg = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode image",
        )

    result = pipeline.process_frame(frame)
    result["boxes"] = [list(box) for box in result["boxes"]]
    if machine_id:
        result["machine_id"] = machine_id

    _latest_result = result
    log.info(
        "Analyzed security frame for machine_id=%s threat_level=%s",
        machine_id or "unknown",
        result["threat"].get("threat_level"),
    )
    return {
        "success": True,
        "data": result,
    }

