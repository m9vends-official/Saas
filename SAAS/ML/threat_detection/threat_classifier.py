from typing import Literal

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

from .config import GROQ_API_KEY, GROQ_MODEL
from .logger import get_logger

log = get_logger(__name__)


class ThreatResult(BaseModel):
    category: Literal["NORMAL", "WEAPON", "PHYSICAL_ATTACK"]
    threat_level: Literal["none", "low", "medium", "high"]
    detected_activity: str = Field(description="Specific activity observed")
    confidence: int = Field(description="Confidence score 0-100")
    reason: str = Field(description="Short explanation")


SYSTEM_PROMPT = """
You are a vending machine security analyst.
Analyze the scene description and output a threat classification.

CATEGORIES:
- NORMAL: phone use, writing, collecting product, passing by, conversation
- WEAPON: knife, gun, stone/brick being used as weapon
- PHYSICAL_ATTACK: kicking, punching, shaking, striking with tool, prying open, covering camera, suspicious loitering

THREAT LEVELS:
- none: normal behavior, no concern
- low: loitering, mildly suspicious but no action yet
- medium: covering camera, suspicious tool visible, aggressive posture near machine
- high: active weapon, hitting/kicking/shaking machine, forced entry attempt

FEW-SHOT EXAMPLES:
Scene: "1. People count: 1\\n2. Actions: kicking lower panel repeatedly\\n3. Objects: none\\n4. Machine interaction: kicking\\n5. Suspicious signs: yes, aggressive physical contact"
Output: {{"category":"PHYSICAL_ATTACK","threat_level":"high","detected_activity":"Kicking machine panel","confidence":94,"reason":"Repeated kicking = active physical attack"}}

Scene: "1. People count: 1\\n2. Actions: using mobile phone\\n3. Objects: phone\\n4. Machine interaction: none\\n5. Suspicious signs: no"
Output: {{"category":"NORMAL","threat_level":"none","detected_activity":"Phone usage near machine","confidence":97,"reason":"Normal behavior, no threat"}}

Scene: "1. People count: 1\\n2. Actions: standing close, holding metal rod\\n3. Objects: metal rod\\n4. Machine interaction: touching side panel\\n5. Suspicious signs: yes, tool in hand near machine"
Output: {{"category":"PHYSICAL_ATTACK","threat_level":"high","detected_activity":"Approaching machine with metal rod","confidence":89,"reason":"Tool in hand + contact = forced entry risk"}}

Scene: "1. People count: 2\\n2. Actions: talking to each other\\n3. Objects: none\\n4. Machine interaction: none\\n5. Suspicious signs: no"
Output: {{"category":"NORMAL","threat_level":"none","detected_activity":"Social interaction near machine","confidence":96,"reason":"Normal behavior"}}

Scene: "1. People count: 1\\n2. Actions: standing still for long time, looking around\\n3. Objects: none\\n4. Machine interaction: none\\n5. Suspicious signs: yes, loitering behavior"
Output: {{"category":"PHYSICAL_ATTACK","threat_level":"low","detected_activity":"Loitering near machine","confidence":72,"reason":"Prolonged presence without purpose"}}

Return ONLY valid JSON. No markdown, no explanation.
"""

_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("human", "Scene: {scene}"),
    ]
)
_chain = None


def _get_chain():
    global _chain
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured")
    if _chain is None:
        llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0.1)
        _chain = _prompt | llm | JsonOutputParser(pydantic_object=ThreatResult)
    return _chain


def classify_threat(scene: str) -> dict:
    """Return a dict matching ThreatResult, falling back safely on failure."""
    try:
        return _get_chain().invoke({"scene": scene})
    except Exception as error:
        log.error(f"Threat classification failed: {error}")
        return {
            "category": "NORMAL",
            "threat_level": "none",
            "detected_activity": "unknown",
            "confidence": 0,
            "reason": f"classification_error: {error}",
        }

