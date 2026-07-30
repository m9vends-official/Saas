import time

from . import output_handler
from .detector import detect_person
from .logger import get_logger
from .scene_describer import describe_scene
from .threat_classifier import classify_threat

log = get_logger(__name__)


class VendingSecurityPipeline:
    def process_frame(self, frame) -> dict:
        """Run person detection, scene description, and threat classification."""
        boxes = []
        scene = ""

        try:
            boxes = detect_person(frame)
        except Exception as error:
            log.error(f"Person detection failed: {error}")

        try:
            scene = describe_scene(frame)
        except Exception as error:
            log.error(f"Scene description failed, skipping classification: {error}")
            threat = {
                "category": "NORMAL",
                "threat_level": "none",
                "detected_activity": "unknown",
                "confidence": 0,
                "reason": f"scene_description_error: {error}",
            }
            result = self._build_result(boxes, scene, threat)
            output_handler.handle(threat)
            return result

        threat = classify_threat(scene)
        result = self._build_result(boxes, scene, threat)
        output_handler.handle(threat)
        return result

    @staticmethod
    def _build_result(boxes, scene, threat) -> dict:
        return {
            "timestamp": time.time(),
            "people_detected": len(boxes),
            "boxes": boxes,
            "scene": scene,
            "threat": threat,
        }

