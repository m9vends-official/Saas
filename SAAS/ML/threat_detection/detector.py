from ultralytics import YOLO

from .config import PERSON_CONF
from .logger import get_logger

log = get_logger(__name__)

_yolo = None


def get_model():
    global _yolo
    if _yolo is None:
        log.info("Loading YOLO model...")
        _yolo = YOLO("yolov8n.pt")
        log.info("YOLO model ready")
    return _yolo


def detect_person(frame):
    """Return (x1, y1, x2, y2, confidence) boxes for detected people."""
    model = get_model()
    results = model(frame, classes=[0], conf=PERSON_CONF, verbose=False)[0]
    boxes = []
    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        boxes.append((x1, y1, x2, y2, float(box.conf[0])))
    return boxes

