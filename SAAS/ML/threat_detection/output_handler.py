"""Hardware-facing hook for actionable security threats."""

from .logger import get_logger

log = get_logger(__name__)

ACTION_LEVELS = {"medium", "high"}


def handle(result: dict):
    """Handle the threat result for hardware or notifications."""
    level = result.get("threat_level", "none")
    if level in ACTION_LEVELS:
        log.warning(f"ACTIONABLE THREAT [{level}]: {result}")
    else:
        log.info(f"No action needed [{level}]: {result.get('detected_activity')}")

