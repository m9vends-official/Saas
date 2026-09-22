import base64
import io
import re
import time

import cv2
import requests
from PIL import Image

from .config import HF_QWEN_MODEL, HF_TOKEN, VLM_MAX_RETRIES, VLM_TIMEOUT_SECONDS
from .logger import get_logger

log = get_logger(__name__)

HF_ENDPOINT = "https://router.huggingface.co/v1/chat/completions"

SCENE_PROMPT_TEMPLATE = (
    "You are a security camera AI for a vending machine.\n\n"
    "Frame size: {w}x{h} pixels.\n\n"
    "Describe ONLY what is visibly happening. Be factual, no speculation.\n\n"
    "Reply in EXACTLY this format:\n"
    "1. People count: <number>\n"
    "2. Actions: <describe each person's action briefly>\n"
    "3. Objects: <list any weapons, tools, or unusual objects - or 'none'>\n"
    "4. Machine interaction: <none / touching / hitting / kicking / shaking / prying / covering camera>\n"
    "5. Suspicious signs: <yes or no, one sentence max>\n\n"
    "Do NOT classify threat level. Do NOT speculate about intent. "
    "Max 2 sentences per field."
)


def _frame_to_b64(frame) -> str:
    pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    buffer = io.BytesIO()
    pil_img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode()


def describe_scene(frame) -> str:
    """Return a cleaned text description of the frame."""
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is not configured")

    h, w = frame.shape[:2]
    image_b64 = _frame_to_b64(frame)

    payload = {
        "model": HF_QWEN_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}"
                        },
                    },
                    {"type": "text", "text": SCENE_PROMPT_TEMPLATE.format(w=w, h=h)},
                ],
            }
        ],
        "max_tokens": 100,
        "temperature": 0,
    }
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json",
    }

    last_error = None
    for attempt in range(1, VLM_MAX_RETRIES + 2):
        try:
            response = requests.post(
                HF_ENDPOINT,
                headers=headers,
                json=payload,
                timeout=VLM_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            raw = response.json()["choices"][0]["message"]["content"]
            raw = re.sub(r"\?+", "", raw)
            return re.sub(r"\s+", " ", raw).strip()
        except Exception as error:
            last_error = error
            log.warning(f"VLM call failed (attempt {attempt}): {error}")
            time.sleep(1.5 * attempt)

    log.error(f"VLM call failed after {VLM_MAX_RETRIES + 1} attempts: {last_error}")
    raise RuntimeError(f"Scene description failed: {last_error}")

