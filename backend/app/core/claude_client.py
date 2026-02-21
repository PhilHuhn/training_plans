import json
from typing import Optional
import anthropic
from app.core.config import settings


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
                max_tokens=8192,  # Increased for long training plans
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            # Extract text content
            response_text = message.content[0].text

            # Debug: log response length and first 500 chars
            print(f"[DEBUG] Claude response length: {len(response_text)}")
            print(f"[DEBUG] Claude response start: {response_text[:500]}")

            # Parse JSON from response - extract JSON more robustly
            json_text = self._extract_json(response_text)

            print(f"[DEBUG] Extracted JSON length: {len(json_text)}")
            print(f"[DEBUG] Extracted JSON start: {json_text[:500] if json_text else 'EMPTY'}")

            return json.loads(json_text)

        except json.JSONDecodeError as e:
            # Try to fix common JSON issues
            try:
                fixed_json = self._fix_json(json_text if 'json_text' in locals() else response_text)
                return json.loads(fixed_json)
            except Exception:
                return {
                    "error": f"Failed to parse Claude response as JSON: {str(e)}",
                    "raw_response": response_text[:2000] if 'response_text' in locals() else None
                }
        except anthropic.APIError as e:
            return {
                "error": f"Claude API error: {str(e)}"
            }

    def _extract_json(self, text: str) -> str:
        """Extract JSON from text, handling code blocks and raw JSON."""
        # Handle markdown code blocks - find content between ```json and closing ```
        if "```json" in text:
            json_start = text.find("```json") + 7
            # Skip to next line after ```json
            newline_after_marker = text.find("\n", json_start)
            if newline_after_marker > json_start:
                json_start = newline_after_marker + 1
            json_end = text.find("```", json_start)
            if json_end > json_start:
                extracted = text[json_start:json_end].strip()
                if extracted:
                    print(f"[DEBUG] Extracted from ```json block, length: {len(extracted)}")
                    return extracted

        if "```" in text and "```json" not in text:
            json_start = text.find("```") + 3
            # Skip language identifier if present (e.g., ```javascript)
            newline_pos = text.find("\n", json_start)
            if newline_pos > json_start and newline_pos < json_start + 20:
                json_start = newline_pos + 1
            json_end = text.find("```", json_start)
            if json_end > json_start:
                extracted = text[json_start:json_end].strip()
                if extracted:
                    print(f"[DEBUG] Extracted from ``` block, length: {len(extracted)}")
                    return extracted

        # Try to find JSON object directly - handle strings inside JSON properly
        first_brace = text.find("{")
        if first_brace >= 0:
            print(f"[DEBUG] Found first brace at position {first_brace}")
            # Find matching closing brace, accounting for strings
            depth = 0
            in_string = False
            escape_next = False
            for i, char in enumerate(text[first_brace:], first_brace):
                if escape_next:
                    escape_next = False
                    continue
                if char == "\\" and in_string:
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if char == "{":
                        depth += 1
                    elif char == "}":
                        depth -= 1
                        if depth == 0:
                            extracted = text[first_brace:i+1]
                            print(f"[DEBUG] Extracted raw JSON, length: {len(extracted)}")
                            return extracted

        print(f"[DEBUG] No JSON extraction method worked, returning stripped text")
        return text.strip()

    def _fix_json(self, text: str) -> str:
        """Attempt to fix common JSON issues."""
        import re
        # Remove trailing commas before ] or }
        text = re.sub(r',\s*([}\]])', r'\1', text)
        # Fix unquoted property names (simple cases)
        text = re.sub(r'(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', text)
        return text

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
                max_tokens=8192,  # Higher limit for parsing large documents
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            # Extract text content
            response_text = message.content[0].text

            # Parse JSON from response
            # Handle case where Claude might wrap in markdown code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()

            return json.loads(response_text)

        except json.JSONDecodeError as e:
            return {
                "error": f"Failed to parse Claude response as JSON: {str(e)}",
                "raw_response": response_text if 'response_text' in locals() else None
            }
        except anthropic.APIError as e:
            return {
                "error": f"Claude API error: {str(e)}"
            }


# Singleton instance
claude_client = ClaudeClient()
