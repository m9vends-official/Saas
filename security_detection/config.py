import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
HF_TOKEN = os.getenv("HF_TOKEN")

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
HF_QWEN_MODEL = os.getenv("HF_QWEN_MODEL", "Qwen/Qwen2.5-VL-72B-Instruct")

PERSON_CONF = float(os.getenv("PERSON_CONF", "0.5"))
FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "3"))
VLM_TIMEOUT_SECONDS = int(os.getenv("VLM_TIMEOUT_SECONDS", "60"))
VLM_MAX_RETRIES = int(os.getenv("VLM_MAX_RETRIES", "2"))

LOG_DIR = os.getenv("SECURITY_LOG_DIR", os.getenv("LOG_DIR", "logs"))
LOG_LEVEL = os.getenv("SECURITY_LOG_LEVEL", os.getenv("LOG_LEVEL", "INFO"))


def runtime_config_status():
    return {
        "groq_api_key_configured": bool(GROQ_API_KEY),
        "hf_token_configured": bool(HF_TOKEN),
        "groq_model": GROQ_MODEL,
        "hf_qwen_model": HF_QWEN_MODEL,
        "person_confidence": PERSON_CONF,
        "vlm_timeout_seconds": VLM_TIMEOUT_SECONDS,
        "vlm_max_retries": VLM_MAX_RETRIES,
    }

