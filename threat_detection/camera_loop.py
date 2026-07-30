
import time

import cv2

from .config import FRAME_INTERVAL_SECONDS
from .logger import get_logger
from .pipeline import VendingSecurityPipeline

log = get_logger(__name__)


def run(camera_index: int = 0):
    pipeline = VendingSecurityPipeline()
    cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        log.error("Could not open camera. Check camera_index / connection.")
        return

    log.info("Security pipeline started. Press Ctrl+C to stop.")
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                log.warning("Frame capture failed, retrying...")
                time.sleep(1)
                continue

            result = pipeline.process_frame(frame)
            threat = result["threat"]
            log.info(
                "[%s] %s - %s (conf=%s)",
                threat["threat_level"].upper(),
                threat["category"],
                threat["detected_activity"],
                threat["confidence"],
            )

            time.sleep(FRAME_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        log.info("Stopped by user.")
    finally:
        cap.release()


if __name__ == "__main__":
    run()

