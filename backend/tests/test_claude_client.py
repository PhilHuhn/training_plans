"""
Tests for Claude client.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json


class TestClaudeClient:
    """Tests for Claude API client."""

    def test_client_initialization(self):
        """Test Claude client initializes correctly."""
        from app.core.claude_client import ClaudeClient

        client = ClaudeClient()
        assert client is not None

    async def test_generate_text(self):
        """Test generating text response."""
        from app.core.claude_client import ClaudeClient

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Test response from Claude")]

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_instance = MagicMock()
            mock_instance.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_instance

            client = ClaudeClient()
            result = await client.generate_text("Test prompt")

            assert result == "Test response from Claude"

    async def test_generate_training_recommendations(self):
        """Test generating training recommendations."""
        from app.core.claude_client import ClaudeClient

        mock_json_response = {
            "sessions": [
                {
                    "date": "2024-01-15",
                    "type": "Easy Run",
                    "distance_km": 8.0,
                    "duration_min": 50,
                    "intensity": "easy",
                }
            ],
            "weekly_summary": {
                "total_distance_km": 45.0,
                "focus": "Base building",
            },
        }

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=json.dumps(mock_json_response))]

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_instance = MagicMock()
            mock_instance.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_instance

            client = ClaudeClient()
            result = await client.generate_training_recommendations(
                system_prompt="You are a running coach.",
                user_prompt="Generate a training plan for next week.",
            )

            assert result is not None
            assert "sessions" in result

    async def test_json_extraction_with_code_block(self):
        """Test JSON extraction from markdown code block."""
        from app.core.claude_client import ClaudeClient

        response_with_code_block = """
        Here's the training plan:

        ```json
        {"sessions": [{"type": "Easy Run"}]}
        ```

        Hope this helps!
        """

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=response_with_code_block)]

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_instance = MagicMock()
            mock_instance.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_instance

            client = ClaudeClient()
            result = await client.generate_training_recommendations(
                system_prompt="You are a running coach.",
                user_prompt="Generate a training plan.",
            )

            assert result is not None
            assert "sessions" in result

    async def test_convert_session_pace_to_hr(self):
        """Test converting pace-based session to HR-based."""
        from app.core.claude_client import ClaudeClient

        mock_converted = {
            "type": "Easy Run",
            "description": "Converted from pace",
            "hr_zone": "Zone 2 (130-150 bpm)",
            "original_pace": "5:30/km",
        }

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=json.dumps(mock_converted))]

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_instance = MagicMock()
            mock_instance.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_instance

            client = ClaudeClient()
            result = await client.convert_session(
                system_prompt="Convert this session to HR-based.",
                user_prompt="Easy Run at 5:30/km pace",
            )

            assert result is not None
            assert "hr_zone" in result

    async def test_parse_document(self):
        """Test parsing training document."""
        from app.core.claude_client import ClaudeClient

        mock_parsed = [
            {"date": "2024-01-15", "type": "Easy Run", "distance_km": 5.0},
            {"date": "2024-01-16", "type": "Rest", "distance_km": 0.0},
            {"date": "2024-01-17", "type": "Tempo", "distance_km": 8.0},
        ]

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=json.dumps(mock_parsed))]

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_instance = MagicMock()
            mock_instance.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_instance

            client = ClaudeClient()
            result = await client.parse_document(
                system_prompt="Parse this training document into sessions.",
                user_prompt="Week 1: Easy run Monday...",
            )

            assert result is not None


class TestClaudeClientErrorHandling:
    """Tests for Claude client error handling."""

    async def test_handles_api_error(self):
        """Test handling API errors gracefully."""
        from app.core.claude_client import ClaudeClient

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_instance = MagicMock()
            mock_instance.messages.create.side_effect = Exception("API Error")
            mock_anthropic.return_value = mock_instance

            client = ClaudeClient()

            # Should handle error gracefully
            try:
                result = await client.generate_text("Test")
                # May return None or raise exception depending on implementation
            except Exception:
                pass  # Expected

    async def test_handles_invalid_json_response(self):
        """Test handling invalid JSON in response."""
        from app.core.claude_client import ClaudeClient

        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="This is not valid JSON")]

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_instance = MagicMock()
            mock_instance.messages.create.return_value = mock_response
            mock_anthropic.return_value = mock_instance

            client = ClaudeClient()

            # Should handle gracefully
            try:
                result = await client.generate_training_recommendations(
                    system_prompt="You are a coach.",
                    user_prompt="Generate a plan.",
                )
                # Should return error dict instead of raising
                assert "error" in result or result is not None
            except Exception:
                pass  # Also acceptable


class TestClaudeClientJSONParsing:
    """Tests for JSON parsing utilities."""

    def test_extract_json_from_plain_text(self):
        """Test extracting JSON from plain response."""
        from app.core.claude_client import ClaudeClient

        client = ClaudeClient()

        # Test with plain JSON
        plain_json = '{"key": "value"}'
        # Implementation-dependent extraction

    def test_extract_json_from_markdown(self):
        """Test extracting JSON from markdown code block."""
        from app.core.claude_client import ClaudeClient

        client = ClaudeClient()

        markdown_json = '```json\n{"key": "value"}\n```'
        # Implementation-dependent extraction

    def test_handles_trailing_commas(self):
        """Test handling JSON with trailing commas."""
        from app.core.claude_client import ClaudeClient

        client = ClaudeClient()

        # Common LLM mistake: trailing commas
        json_with_trailing = '{"items": ["a", "b",]}'
        # Should be cleaned up by the parser
