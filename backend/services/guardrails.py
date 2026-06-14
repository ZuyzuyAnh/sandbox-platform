"""
Guardrail enforcement for the LLM gateway.

A guardrail inspects the user's prompt *before* it is proxied to the LLM and
either lets it through or blocks it with a reason. Policies are stored in the
DB and attached to virtual keys; this module holds the actual check logic and
the built-in scenarios seeded on startup.
"""
import re

# ── Built-in scenarios seeded on first startup ────────────────────────────────
# "fix sẵn 2-3 kịch bản" — admins can edit/disable these or add their own.
DEFAULT_POLICIES: list[dict] = [
    {
        "name": "Block secrets & credentials",
        "description": "Stops prompts that try to exfiltrate passwords, API keys or tokens.",
        "type": "blocked_keywords",
        "config": {"keywords": ["password", "api_key", "secret_key", "private key", "credential"]},
    },
    {
        "name": "PII protection",
        "description": "Blocks prompts containing email addresses or phone numbers.",
        "type": "pii_block",
        "config": {},
    },
    {
        "name": "Prompt size limit",
        "description": "Rejects oversized prompts (> 12,000 characters) to control cost.",
        "type": "max_prompt_chars",
        "config": {"limit": 12000},
    },
]

VALID_TYPES = {"blocked_keywords", "pii_block", "max_prompt_chars"}

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")


def check_prompt(prompt: str, policies: list[dict]) -> str | None:
    """
    Run every enabled policy against the prompt.
    Returns a human-readable violation message, or None if the prompt is allowed.
    """
    lowered = prompt.lower()
    for p in policies:
        if not p.get("enabled", True):
            continue
        ptype = p["type"]
        cfg = p.get("config") or {}

        if ptype == "blocked_keywords":
            for kw in cfg.get("keywords", []):
                if kw.lower() in lowered:
                    return f"Blocked by guardrail '{p['name']}': prompt contains a forbidden term."

        elif ptype == "pii_block":
            if _EMAIL_RE.search(prompt) or _PHONE_RE.search(prompt):
                return f"Blocked by guardrail '{p['name']}': prompt appears to contain personal data (email/phone)."

        elif ptype == "max_prompt_chars":
            limit = int(cfg.get("limit", 12000))
            if len(prompt) > limit:
                return f"Blocked by guardrail '{p['name']}': prompt exceeds {limit:,} characters."

    return None
