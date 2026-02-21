import json
import re
from typing import Optional
import anthropic
from app.core.config import settings

# Short-key → full-key mappings for training recommendations
_TOP_KEYS = {"a": "analysis", "wf": "weekly_focus", "ss": "sessions", "w": "warnings"}
_SESSION_KEYS = {
    "d": "date", "t": "type", "s": "sport", "desc": "description",
    "km": "distance_km", "min": "duration_min", "int": "intensity",
    "hr": "hr_zone", "pace": "pace_range", "pw": "power_target_watts",
    "ivl": "intervals", "n": "notes",
}
_INTERVAL_KEYS = {"r": "reps", "dm": "distance_m", "tp": "target_pace", "rec": "recovery"}


def expand_short_keys(data: dict) -> dict:
    """Expand short-key notation from Claude back to full keys.
    Works with both short and full key formats (idempotent)."""
    if not isinstance(data, dict):
        return data

    out = {}

    # Expand top-level keys
    for k, v in data.items():
        full_key = _TOP_KEYS.get(k, k)
        out[full_key] = v

    # Expand sessions array
    if "sessions" in out and isinstance(out["sessions"], list):
        expanded_sessions = []
        for sess in out["sessions"]:
            if not isinstance(sess, dict):
                expanded_sessions.append(sess)
                continue
            expanded = {}
            for k, v in sess.items():
                full_key = _SESSION_KEYS.get(k, k)
                if full_key == "intervals" and isinstance(v, list):
                    # Expand interval sub-objects
                    expanded_ivl = []
                    for ivl in v:
                        if isinstance(ivl, dict):
                            expanded_ivl.append(
                                {_INTERVAL_KEYS.get(ik, ik): iv for ik, iv in ivl.items()}
                            )
                        else:
                            expanded_ivl.append(ivl)
                    expanded[full_key] = expanded_ivl
                else:
                    expanded[full_key] = v
            expanded_sessions.append(expanded)
        out["sessions"] = expanded_sessions

    return out


class ClaudeClient:
    """Client for interacting with Claude API for training recommendations."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-sonnet-4-20250514"

    async def generate_training_recommendations(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """Generate training recommendations using Claude."""
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=16384,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            response_text = message.content[0].text
            stop_reason = message.stop_reason

            print(f"[DEBUG] Claude response length: {len(response_text)}, stop_reason: {stop_reason}")
            print(f"[DEBUG] Claude response start: {response_text[:500]}")
            print(f"[DEBUG] Claude response end: ...{response_text[-200:]}")

            if stop_reason == "max_tokens":
                print(f"[WARN] Response was truncated at max_tokens!")

            json_text = self._extract_json(response_text)

            print(f"[DEBUG] Extracted JSON length: {len(json_text)}")

            result = json.loads(json_text)

            # Expand short keys to full keys (idempotent — works with both formats)
            result = expand_short_keys(result)

            return result

        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON decode error: {e}")
            # Try to fix common JSON issues
            try:
                fixed_json = self._fix_json(json_text if 'json_text' in locals() else response_text)
                result = json.loads(fixed_json)
                print(f"[DEBUG] JSON repair succeeded")
                return expand_short_keys(result)
            except Exception as e2:
                print(f"[ERROR] JSON fix also failed: {e2}")
                return {
                    "error": f"Failed to parse Claude response as JSON: {str(e)}",
                    "raw_response": response_text[:2000] if 'response_text' in locals() else None
                }
        except anthropic.APIError as e:
            return {
                "error": f"Claude API error: {str(e)}"
            }

    def _extract_json(self, text: str) -> str:
        """Extract JSON from text, handling code blocks and truncated responses."""
        text = text.strip()

        # Step 1: Strip markdown code fences via regex (handles missing closing fence)
        text = re.sub(r'^```(?:json|JSON)?\s*\n?', '', text)
        text = re.sub(r'\n?```\s*$', '', text)
        text = text.strip()

        # Step 2: If it starts with { or [, return directly (fence already stripped)
        if text.startswith('{') or text.startswith('['):
            print(f"[DEBUG] Extracted JSON after fence strip, length: {len(text)}")
            return text

        # Step 3: Find JSON object via brace matching (handles surrounding text)
        first_brace = text.find('{')
        if first_brace >= 0:
            depth = 0
            in_string = False
            escape_next = False
            for i, char in enumerate(text[first_brace:], first_brace):
                if escape_next:
                    escape_next = False
                    continue
                if char == '\\' and in_string:
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            extracted = text[first_brace:i + 1]
                            print(f"[DEBUG] Extracted JSON via brace matching, length: {len(extracted)}")
                            return extracted

            # Brace matching didn't complete — JSON is likely truncated
            print(f"[WARN] JSON appears truncated (unclosed braces at depth {depth}), returning from first brace")
            return text[first_brace:]

        print(f"[DEBUG] No JSON found in text, returning as-is")
        return text

    def _fix_json(self, text: str) -> str:
        """Attempt to fix common JSON issues including truncation."""
        # Strip any remaining code fences
        text = re.sub(r'^```(?:json|JSON)?\s*\n?', '', text.strip())
        text = re.sub(r'\n?```\s*$', '', text)
        text = text.strip()

        # Remove trailing commas before ] or }
        text = re.sub(r',\s*([}\]])', r'\1', text)
        # Fix unquoted property names (simple cases)
        text = re.sub(r'(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', text)

        # Try to repair truncated JSON
        if not self._is_valid_json(text):
            text = self._repair_truncated_json(text)

        return text

    def _is_valid_json(self, text: str) -> bool:
        try:
            json.loads(text)
            return True
        except (json.JSONDecodeError, ValueError):
            return False

    def _repair_truncated_json(self, text: str) -> str:
        """Try to repair truncated JSON by closing open brackets/braces."""
        # Track open brackets outside of strings
        stack = []
        in_string = False
        escape_next = False

        for char in text:
            if escape_next:
                escape_next = False
                continue
            if char == '\\' and in_string:
                escape_next = True
                continue
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
            if not in_string:
                if char in '{[':
                    stack.append(char)
                elif char in '}]':
                    if stack:
                        stack.pop()

        if not stack:
            return text  # Already balanced

        # Remove any trailing incomplete element (partial string, key without value, etc.)
        truncated = text.rstrip()
        # Remove trailing incomplete string value
        truncated = re.sub(r',\s*"[^"]*"?\s*:\s*"[^"]*$', '', truncated)
        # Remove trailing incomplete key
        truncated = re.sub(r',\s*"[^"]*$', '', truncated)
        # Remove trailing comma
        truncated = re.sub(r',\s*$', '', truncated)

        # Close remaining open brackets/braces
        for bracket in reversed(stack):
            truncated += '}' if bracket == '{' else ']'

        print(f"[DEBUG] Repaired truncated JSON: closed {len(stack)} bracket(s)")
        return truncated

    async def generate_text(
        self,
        prompt: str,
        max_tokens: int = 1024,
    ) -> str:
        """Generate plain text response from Claude (no JSON parsing)."""
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return message.content[0].text
        except anthropic.APIError as e:
            raise Exception(f"Claude API error: {str(e)}")

    async def convert_session(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """Convert a training session between pace and HR formats."""
        return await self.generate_training_recommendations(system_prompt, user_prompt)

    async def parse_document(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """Parse a training plan document - uses higher token limit for large plans."""
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=16384,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            response_text = message.content[0].text
            stop_reason = message.stop_reason

            print(f"[DEBUG] Document parse response length: {len(response_text)}, stop_reason: {stop_reason}")

            if stop_reason == "max_tokens":
                print(f"[WARN] Document parse response was truncated!")

            # Reuse the robust extraction
            json_text = self._extract_json(response_text)
            return json.loads(json_text)

        except json.JSONDecodeError as e:
            try:
                fixed = self._fix_json(json_text if 'json_text' in locals() else response_text)
                return json.loads(fixed)
            except Exception:
                return {
                    "error": f"Failed to parse Claude response as JSON: {str(e)}",
                    "raw_response": response_text[:2000] if 'response_text' in locals() else None
                }
        except anthropic.APIError as e:
            return {
                "error": f"Claude API error: {str(e)}"
            }


# Singleton instance
claude_client = ClaudeClient()
