import os
from datetime import datetime, timezone
from threading import Lock

import joblib
import pandas as pd

try:
    from . import model as training
except ImportError:  
    import model as training


ANOMALY_PROB_THRESHOLD = float(os.getenv("ANOMALY_PROB_THRESHOLD", "0.5"))
CONSEC_ANOMALIES_TO_STOP = int(os.getenv("CONSEC_ANOMALIES_TO_STOP", "1"))


class AnomalyDetector:
    def __init__(
        self,
        model_path=training.MODEL_PATH,
        threshold=ANOMALY_PROB_THRESHOLD,
        consecutive_anomalies_to_stop=CONSEC_ANOMALIES_TO_STOP,
    ):
        self.model_path = model_path
        self.threshold = threshold
        self.consecutive_anomalies_to_stop = consecutive_anomalies_to_stop
        self._lock = Lock()
        self._model = None
        self.features = []
        self._consecutive_anomalies = 0

    @property
    def loaded(self):
        return self._model is not None

    def load(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found: {self.model_path}")

        bundle = joblib.load(self.model_path)
        if not isinstance(bundle, dict) or "model" not in bundle:
            raise ValueError("Model file must contain a bundle with a 'model' key")

        self._model = bundle["model"]
        self.features = list(bundle.get("features", training.FEATURES))
        self._consecutive_anomalies = 0
        return self

    def reset_state(self):
        with self._lock:
            self._consecutive_anomalies = 0

    def info(self):
        return {
            "loaded": self.loaded,
            "model_path": self.model_path,
            "model_exists": os.path.exists(self.model_path),
            "features": self.features or training.FEATURES,
            "threshold": self.threshold,
            "consecutive_anomalies_to_stop": self.consecutive_anomalies_to_stop,
            "consecutive_anomalies": self._consecutive_anomalies,
        }

    def predict(self, reading):
        self._ensure_loaded()
        normalized = self._normalize_reading(reading)
        frame = pd.DataFrame([normalized], columns=self.features)

        with self._lock:
            prediction = int(self._model.predict(frame)[0])
            anomaly_probability = self._anomaly_probability(frame)
            is_anomaly = prediction == 1 and anomaly_probability >= self.threshold
            if is_anomaly:
                self._consecutive_anomalies += 1
            else:
                self._consecutive_anomalies = 0

            should_stop = self._consecutive_anomalies >= self.consecutive_anomalies_to_stop

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "input": normalized,
            "prediction": prediction,
            "anomaly_probability": round(anomaly_probability, 4),
            "is_anomaly": is_anomaly,
            "action": "STOP_MACHINE" if should_stop else "CONTINUE",
        }

    def _ensure_loaded(self):
        if not self.loaded:
            self.load()

    def _normalize_reading(self, reading):
        missing_fields = [feature for feature in self.features if feature not in reading]
        if missing_fields:
            raise ValueError(f"Missing fields: {', '.join(missing_fields)}")

        try:
            return {feature: float(reading[feature]) for feature in self.features}
        except (TypeError, ValueError) as error:
            raise ValueError("Sensor reading values must be numbers") from error

    def _anomaly_probability(self, frame):
        if not hasattr(self._model, "predict_proba"):
            return 1.0 if int(self._model.predict(frame)[0]) == 1 else 0.0

        probabilities = self._model.predict_proba(frame)[0]
        classes = list(getattr(self._model, "classes_", []))
        if 1 in classes:
            return float(probabilities[classes.index(1)])
        return float(max(probabilities))
