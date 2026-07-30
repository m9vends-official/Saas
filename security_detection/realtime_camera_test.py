import argparse
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import requests


def parse_args():
    parser = argparse.ArgumentParser(
        description="Capture webcam frames and send them to the security API."
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8001/analyze",
        help="Security API analyze endpoint.",
    )
    parser.add_argument(
        "--machine-id",
        default="VM-TEST",
        help="Machine ID to include with each frame.",
    )
    parser.add_argument(
        "--camera-index",
        type=int,
        default=0,
        help="OpenCV camera index.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=3.0,
        help="Seconds between analysis requests.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="HTTP timeout in seconds.",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="Optional capture width.",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=480,
        help="Optional capture height.",
    )
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Run without opening an OpenCV preview window.",
    )
    return parser.parse_args()


def analyze_frame(api_url, machine_id, frame, timeout):
    ok, encoded = cv2.imencode(".jpg", frame)
    if not ok:
        raise RuntimeError("Could not encode camera frame as JPEG")

    files = {
        "file": ("frame.jpg", encoded.tobytes(), "image/jpeg"),
    }
    data = {
        "machine_id": machine_id,
    }
    response = requests.post(api_url, files=files, data=data, timeout=timeout)
    response.raise_for_status()
    return response.json()


def extract_result(payload):
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        return payload["data"]
    return payload


def draw_latest_result(frame, latest_result):
    if not latest_result:
        cv2.putText(
            frame,
            "Waiting for first analysis...",
            (16, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2,
        )
        return

    threat = latest_result.get("threat", {})
    level = threat.get("threat_level", "unknown").upper()
    activity = threat.get("detected_activity", "unknown")
    confidence = threat.get("confidence", 0)
    people = latest_result.get("people_detected", 0)

    color = (0, 0, 255) if level in {"MEDIUM", "HIGH"} else (0, 180, 0)
    header = f"{level} | people={people} | conf={confidence}"
    cv2.putText(frame, header, (16, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    cv2.putText(
        frame,
        activity[:70],
        (16, 62),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        color,
        2,
    )

    for box in latest_result.get("boxes", []):
        if len(box) < 4:
            continue
        x1, y1, x2, y2 = [int(value) for value in box[:4]]
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)


def print_result(result):
    threat = result.get("threat", {})
    print(
        "[{level}] people={people} activity={activity} confidence={confidence}".format(
            level=threat.get("threat_level", "unknown").upper(),
            people=result.get("people_detected", 0),
            activity=threat.get("detected_activity", "unknown"),
            confidence=threat.get("confidence", 0),
        )
    )


def main():
    args = parse_args()
    cap = cv2.VideoCapture(args.camera_index)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera index {args.camera_index}")

    print("Press q in the preview window, or Ctrl+C in the terminal, to stop.")
    print(f"Sending one frame every {args.interval}s to {args.api_url}")

    latest_result = None
    pending = None
    next_send_at = 0.0

    with ThreadPoolExecutor(max_workers=1) as executor:
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("Frame capture failed, retrying...")
                    time.sleep(0.5)
                    continue

                now = time.monotonic()
                if pending is None and now >= next_send_at:
                    pending = executor.submit(
                        analyze_frame,
                        args.api_url,
                        args.machine_id,
                        frame.copy(),
                        args.timeout,
                    )
                    next_send_at = now + args.interval

                if pending is not None and pending.done():
                    try:
                        latest_result = extract_result(pending.result())
                        print_result(latest_result)
                    except Exception as error:
                        print(f"Analysis request failed: {error}")
                    pending = None

                if not args.no_preview:
                    preview = frame.copy()
                    draw_latest_result(preview, latest_result)
                    cv2.imshow("M9Vends Security Camera Test", preview)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                else:
                    time.sleep(0.03)
        except KeyboardInterrupt:
            print("Stopped.")
        finally:
            cap.release()
            if not args.no_preview:
                cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

