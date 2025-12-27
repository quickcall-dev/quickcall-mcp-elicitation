"""
MCP Server demonstrating Elicitation with a Meeting Scheduler Tool.

This server exposes tools for scheduling meetings. When required information
is missing, the tool uses MCP elicitation to gather it from the user.
"""

import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastmcp import FastMCP
from fastmcp.server.dependencies import get_context
from pydantic import BaseModel, Field


# Mock data representing available team members
AVAILABLE_PARTICIPANTS = [
    {"id": "1", "name": "Alice Chen", "email": "alice@example.com"},
    {"id": "2", "name": "Bob Smith", "email": "bob@example.com"},
    {"id": "3", "name": "Carol White", "email": "carol@example.com"},
    {"id": "4", "name": "David Brown", "email": "david@example.com"},
]

DURATION_OPTIONS = [
    "15 minutes",
    "30 minutes",
    "45 minutes",
    "1 hour",
    "1.5 hours",
    "2 hours",
]


class MeetingResult(BaseModel):
    """
    Result of a meeting scheduling operation.

    Contains all details about the scheduled meeting or failure information.
    """

    success: bool
    meeting_id: Optional[str] = None
    title: str
    participants: List[str]
    duration: str
    scheduled_time: str
    message: str


def generate_available_time_slots(count: int = 6) -> List[str]:
    """
    Generate available time slots for the next few days.

    Returns human-readable time slot strings like "Monday 10:00 AM".
    """
    now = datetime.now()
    time_slots = []

    for day_offset in range(3):
        day = now + timedelta(days=day_offset)
        for hour in [9, 10, 11, 14, 15, 16]:
            slot_time = day.replace(hour=hour, minute=0, second=0, microsecond=0)
            if slot_time > now:
                time_slots.append(slot_time.strftime("%A %I:%M %p"))
                if len(time_slots) >= count:
                    return time_slots

    return time_slots


def create_cancelled_result(
    title: str = "",
    participants: Optional[List[str]] = None,
    duration: str = "",
    scheduled_time: str = "",
) -> MeetingResult:
    """
    Create a MeetingResult indicating user cancellation.

    Used when user cancels during any elicitation step.
    """
    return MeetingResult(
        success=False,
        title=title,
        participants=participants or [],
        duration=duration,
        scheduled_time=scheduled_time,
        message="Meeting scheduling cancelled by user.",
    )


# Initialize MCP server
mcp = FastMCP(
    name="meeting-scheduler",
    instructions=(
        "You are a meeting scheduling assistant. When the user wants to schedule "
        "a meeting, use the schedule_meeting tool. The tool will ask for any "
        "missing information through elicitation."
    ),
)


@mcp.tool()
async def schedule_meeting(
    title: Optional[str] = Field(default=None, description="Meeting title"),
    participants: Optional[List[str]] = Field(
        default=None, description="List of participant names"
    ),
    duration: Optional[str] = Field(default=None, description="Meeting duration"),
    preferred_time: Optional[str] = Field(
        default=None, description="Preferred time slot"
    ),
) -> MeetingResult:
    """
    Schedule a meeting with participants.

    Uses MCP elicitation to gather any missing required information from the user.
    Demonstrates progressive form-filling through conversational AI.
    """
    ctx = get_context()

    # Elicit title if not provided (free text input)
    if not title:
        result = await ctx.elicit(
            message="What should the meeting be called?",
            response_type=str,
        )
        if result.action == "cancel":
            return create_cancelled_result()
        # Handle both direct value and dict response from handler
        data = result.data
        if isinstance(data, dict):
            title = data.get("value") or data.get("title") or "Untitled Meeting"
        else:
            title = data if data else "Untitled Meeting"

    # Elicit participants if not provided (multi-select from list)
    if not participants:
        participant_names = [p["name"] for p in AVAILABLE_PARTICIPANTS]
        result = await ctx.elicit(
            message="Who should attend this meeting?",
            response_type=participant_names,
        )
        if result.action == "cancel":
            return create_cancelled_result(title=title)
        # Handle dict or direct response
        data = result.data
        if isinstance(data, dict):
            selected = data.get("value") or data.get("participants") or []
        else:
            selected = data
        # Wrap single selection in list
        if isinstance(selected, str):
            participants = [selected]
        else:
            participants = list(selected) if selected else []

    # Elicit duration if not provided (select from options)
    if not duration:
        result = await ctx.elicit(
            message="How long should the meeting be?",
            response_type=DURATION_OPTIONS,
        )
        if result.action == "cancel":
            return create_cancelled_result(title=title, participants=participants)
        data = result.data
        if isinstance(data, dict):
            duration = data.get("value") or data.get("duration") or "30 minutes"
        else:
            duration = data if data else "30 minutes"

    # Elicit preferred time if not provided (select from options)
    if not preferred_time:
        time_slots = generate_available_time_slots()
        result = await ctx.elicit(
            message="When would you like to schedule this meeting?",
            response_type=time_slots,
        )
        if result.action == "cancel":
            return create_cancelled_result(
                title=title, participants=participants, duration=duration
            )
        data = result.data
        if isinstance(data, dict):
            preferred_time = data.get("value") or data.get("preferred_time") or (
                time_slots[0] if time_slots else "Tomorrow 10:00 AM"
            )
        else:
            preferred_time = data if data else (
                time_slots[0] if time_slots else "Tomorrow 10:00 AM"
            )

    # Generate meeting ID and return success
    meeting_id = f"MTG-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    return MeetingResult(
        success=True,
        meeting_id=meeting_id,
        title=title,
        participants=participants,
        duration=duration,
        scheduled_time=preferred_time,
        message=(
            f"Meeting '{title}' scheduled successfully for {preferred_time} "
            f"with {len(participants)} participant(s)."
        ),
    )


@mcp.tool()
async def list_participants() -> List[dict]:
    """
    List all available participants for meetings.

    Returns team member details including name and email.
    """
    return AVAILABLE_PARTICIPANTS


if __name__ == "__main__":
    host = os.getenv("MCP_HOST", "0.0.0.0")
    port = int(os.getenv("MCP_PORT", "8001"))

    mcp.run(transport="streamable-http", host=host, port=port)
