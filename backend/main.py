"""
Backend service for MCP Elicitation Demo.

This FastAPI server orchestrates chat completions with OpenAI and
communicates with the MCP server for tool execution with elicitation support.
"""

import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport
from openai import OpenAI
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Elicitation Service ---


@dataclass
class PendingElicitation:
    """
    Stores metadata about a pending elicitation request.

    The future is resolved when the user responds via the respond endpoint.
    """

    request_id: str
    message: str
    schema: Optional[Dict[str, Any]] = None
    future: asyncio.Future = field(default_factory=asyncio.Future)


class ElicitationService:
    """
    Manages pending elicitation requests.

    When an MCP tool calls ctx.elicit(), we store the request here and send
    an SSE event to the frontend. The frontend responds via POST /elicitation/respond.
    """

    def __init__(self):
        self._pending: Dict[str, PendingElicitation] = {}

    def create_request(
        self,
        request_id: str,
        message: str,
        schema: Optional[Dict[str, Any]] = None,
    ) -> asyncio.Future:
        """
        Create a new elicitation request and return a future to await.

        The future resolves when respond() is called with matching request_id.
        """
        logger.info(f"Creating elicitation request: {request_id}")
        future: asyncio.Future = asyncio.Future()
        self._pending[request_id] = PendingElicitation(
            request_id=request_id,
            message=message,
            schema=schema,
            future=future,
        )
        return future

    async def respond(self, request_id: str, response_data: Dict[str, Any]) -> bool:
        """
        Resolve a pending elicitation with user's response.

        Returns True if the request was found and resolved.
        """
        logger.info(f"Responding to elicitation {request_id}")
        pending = self._pending.get(request_id)
        if not pending or pending.future.done():
            return False

        pending.future.set_result(response_data)
        del self._pending[request_id]
        return True

    def cancel(self, request_id: str) -> bool:
        """Cancel a pending elicitation request."""
        pending = self._pending.get(request_id)
        if pending and not pending.future.done():
            pending.future.cancel()
            del self._pending[request_id]
            return True
        return False


elicitation_service = ElicitationService()


# --- MCP Client ---


SSECallback = Callable[[Dict[str, Any]], Awaitable[None]]


def extract_options_from_schema(schema: Dict[str, Any]) -> Optional[List[str]]:
    """
    Extract enum options from a JSON schema for UI rendering.

    Handles nested enum definitions in properties.
    """
    if not schema:
        return None

    properties = schema.get("properties", {})
    for prop in properties.values():
        if "enum" in prop:
            return prop["enum"]
        if "items" in prop and "enum" in prop.get("items", {}):
            return prop["items"]["enum"]
    return None


class MCPClient:
    """
    Client for communicating with the MCP server.

    Uses per-request connections and supports elicitation callbacks.
    """

    def __init__(self):
        url = os.getenv("MCP_SERVER_URL", "http://localhost:8001/mcp")
        self.mcp_server_url = url.rstrip("/")
        self._tools_cache: List = []

    @asynccontextmanager
    async def _get_client(self, elicitation_handler=None):
        """Create a fresh MCP client connection."""
        transport = StreamableHttpTransport(url=self.mcp_server_url)
        client = Client(transport, elicitation_handler=elicitation_handler)
        async with client:
            yield client

    async def is_healthy(self) -> bool:
        """Check if MCP server is reachable."""
        try:
            async with self._get_client() as client:
                tools = await client.list_tools()
                return len(tools) > 0
        except Exception as e:
            logger.warning(f"MCP health check failed: {e}")
            return False

    async def get_tools(self) -> List[Dict[str, Any]]:
        """
        Fetch tools from MCP server and convert to OpenAI format.

        Caches tools after first fetch for efficiency.
        """
        if not self._tools_cache:
            try:
                async with self._get_client() as client:
                    mcp_tools = await client.list_tools()
                    self._tools_cache = [
                        {
                            "type": "function",
                            "function": {
                                "name": t.name,
                                "description": t.description,
                                "parameters": t.inputSchema,
                            },
                        }
                        for t in mcp_tools
                    ]
                    logger.info(f"Cached {len(self._tools_cache)} tools from MCP")
            except Exception as e:
                logger.error(f"Failed to fetch MCP tools: {e}")
                return []
        return self._tools_cache

    def create_elicitation_handler(
        self,
        session_id: str,
        sse_callback: SSECallback,
    ):
        """
        Create an elicitation handler for a chat session.

        When MCP tool calls ctx.elicit(), this sends an SSE event and waits.
        """

        async def handler(message: str, response_type, params, context):
            """Handle elicitation request from MCP server."""
            elicitation_id = f"{session_id}_{uuid.uuid4().hex[:8]}"
            logger.info(f"[ELICIT] Handler called: {message}")

            schema = None
            if hasattr(params, "requestedSchema") and params.requestedSchema:
                raw = params.requestedSchema
                if hasattr(raw, "model_dump"):
                    schema = raw.model_dump()
                elif isinstance(raw, dict):
                    schema = raw

            options = extract_options_from_schema(schema)
            logger.info(f"[ELICIT] Extracted options: {options}")

            logger.info(f"[ELICIT] Sending SSE callback for: {elicitation_id}")
            await sse_callback(
                {
                    "type": "elicitation_request",
                    "elicitation_id": elicitation_id,
                    "message": message,
                    "options": options,
                    "schema": schema,
                }
            )
            logger.info(f"[ELICIT] SSE callback sent, creating future")

            future = elicitation_service.create_request(
                request_id=elicitation_id,
                message=message,
                schema=schema,
            )

            try:
                logger.info(f"[ELICIT] Waiting for user response: {elicitation_id}")
                response_data = await asyncio.wait_for(future, timeout=300.0)
                logger.info(f"[ELICIT] Got response: {response_data}")
                return response_data
            except asyncio.TimeoutError:
                logger.warning(f"Elicitation {elicitation_id} timed out")
                return {"action": "cancel"}
            except asyncio.CancelledError:
                logger.warning(f"Elicitation {elicitation_id} cancelled")
                return {"action": "cancel"}

        return handler

    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        session_id: Optional[str] = None,
        sse_callback: Optional[SSECallback] = None,
    ) -> Dict[str, Any]:
        """
        Execute a tool via MCP server.

        If sse_callback is provided, elicitation is supported.
        """
        handler = None
        if sse_callback and session_id:
            handler = self.create_elicitation_handler(session_id, sse_callback)

        try:
            async with self._get_client(elicitation_handler=handler) as client:
                result = await client.call_tool(name=tool_name, arguments=arguments)
                logger.info(f"Tool result type: {type(result)}")

                # Handle CallToolResult object
                if hasattr(result, "structured_content") and result.structured_content:
                    return result.structured_content
                if hasattr(result, "content") and result.content:
                    # content is a list of TextContent objects
                    for item in result.content:
                        if hasattr(item, "text"):
                            try:
                                return json.loads(item.text)
                            except json.JSONDecodeError:
                                pass
                # Legacy handling for list results
                if isinstance(result, list) and len(result) > 0:
                    if hasattr(result[0], "text"):
                        return json.loads(result[0].text)
                return {"result": str(result)}
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return {"error": str(e)}


mcp_client = MCPClient()


# --- Chat Service ---


class ChatService:
    """
    Orchestrates chat completions with OpenAI and MCP tool execution.

    Handles streaming responses with interleaved elicitation events.
    """

    def __init__(self):
        self._openai: Optional[OpenAI] = None

    @property
    def openai(self) -> OpenAI:
        """Lazy-initialize OpenAI client."""
        if self._openai is None:
            self._openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        return self._openai

    async def stream_completion(self, messages: List[Dict[str, Any]]):
        """
        Stream a chat completion with tool support and elicitation.

        Yields SSE-formatted events for the frontend.
        """
        session_id = f"chat_{uuid.uuid4().hex}"
        elicitation_queue: asyncio.Queue = asyncio.Queue()

        system_prompt = {
            "role": "system",
            "content": (
                "You are a meeting scheduling assistant. "
                "IMPORTANT: When the user wants to schedule a meeting, IMMEDIATELY call the schedule_meeting tool. "
                "Do NOT ask the user for details - the tool will handle gathering missing information through elicitation. "
                "Always call the tool first, never ask clarifying questions yourself."
            ),
        }
        messages = [system_prompt] + messages

        tools = await mcp_client.get_tools()

        kwargs = {
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            "messages": messages,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = self.openai.chat.completions.create(**kwargs)

        tool_calls_data = {}
        finish_reason = None

        for chunk in response:
            chunk_dict = {
                "id": chunk.id,
                "object": chunk.object,
                "created": chunk.created,
                "model": chunk.model,
                "choices": [],
            }

            for choice in chunk.choices:
                choice_dict = {
                    "index": choice.index,
                    "delta": {},
                    "finish_reason": choice.finish_reason,
                }

                if choice.finish_reason:
                    finish_reason = choice.finish_reason

                if choice.delta.tool_calls:
                    for tc in choice.delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_data:
                            tool_calls_data[idx] = {
                                "id": "",
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            }
                        if tc.id:
                            tool_calls_data[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_data[idx]["function"]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls_data[idx]["function"]["arguments"] += tc.function.arguments

                    choice_dict["delta"]["tool_calls"] = [
                        {
                            "index": tc.index,
                            "id": tc.id,
                            "type": tc.type,
                            "function": {
                                "name": tc.function.name if tc.function else None,
                                "arguments": tc.function.arguments if tc.function else None,
                            },
                        }
                        for tc in choice.delta.tool_calls
                    ]

                if choice.delta.role:
                    choice_dict["delta"]["role"] = choice.delta.role
                if choice.delta.content:
                    choice_dict["delta"]["content"] = choice.delta.content

                chunk_dict["choices"].append(choice_dict)

            yield json.dumps(chunk_dict)

        if finish_reason == "tool_calls" and tool_calls_data:
            assistant_message = {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tool_calls_data[i]["id"],
                        "type": "function",
                        "function": {
                            "name": tool_calls_data[i]["function"]["name"],
                            "arguments": tool_calls_data[i]["function"]["arguments"],
                        },
                    }
                    for i in sorted(tool_calls_data.keys())
                ],
            }

            tool_results = []
            for tc_data in [tool_calls_data[i] for i in sorted(tool_calls_data.keys())]:
                tool_name = tc_data["function"]["name"]
                tool_id = tc_data["id"]

                try:
                    arguments = json.loads(tc_data["function"]["arguments"])
                except json.JSONDecodeError:
                    arguments = {}

                yield json.dumps({'type': 'tool_start', 'name': tool_name, 'args': arguments})

                async def sse_callback(event: Dict[str, Any]):
                    await elicitation_queue.put(event)

                tool_task = asyncio.create_task(
                    mcp_client.execute_tool(
                        tool_name=tool_name,
                        arguments=arguments,
                        session_id=session_id,
                        sse_callback=sse_callback,
                    )
                )

                while not tool_task.done():
                    try:
                        event = await asyncio.wait_for(elicitation_queue.get(), timeout=0.1)
                        yield json.dumps(event)
                    except asyncio.TimeoutError:
                        continue

                result = await tool_task
                yield json.dumps({'type': 'tool_result', 'name': tool_name, 'result': result})

                tool_results.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_id,
                        "content": json.dumps(result),
                    }
                )

            new_messages = messages + [assistant_message] + tool_results
            follow_up = self.openai.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=new_messages,
                stream=True,
            )

            for chunk in follow_up:
                chunk_dict = {
                    "id": chunk.id,
                    "object": chunk.object,
                    "created": chunk.created,
                    "model": chunk.model,
                    "choices": [],
                }

                for choice in chunk.choices:
                    choice_dict = {
                        "index": choice.index,
                        "delta": {},
                        "finish_reason": choice.finish_reason,
                    }
                    if choice.delta.role:
                        choice_dict["delta"]["role"] = choice.delta.role
                    if choice.delta.content:
                        choice_dict["delta"]["content"] = choice.delta.content
                    chunk_dict["choices"].append(choice_dict)

                yield json.dumps(chunk_dict)

        yield "[DONE]"


chat_service = ChatService()


# --- FastAPI App ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    logger.info("Starting MCP Elicitation Demo Backend")
    healthy = await mcp_client.is_healthy()
    if healthy:
        logger.info("MCP server is healthy")
    else:
        logger.warning("MCP server is not reachable")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="MCP Elicitation Demo",
    description="Backend for demonstrating MCP elicitation with meeting scheduling",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """Request body for chat completions."""

    messages: List[Dict[str, Any]]


class ElicitationResponse(BaseModel):
    """Request body for elicitation responses."""

    elicitation_id: str
    response: Dict[str, Any]


@app.get("/health")
async def health():
    """Health check endpoint."""
    mcp_healthy = await mcp_client.is_healthy()
    return {"status": "ok", "mcp": mcp_healthy}


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Stream a chat completion with tool and elicitation support.

    Returns Server-Sent Events with chat chunks and elicitation requests.
    """
    return EventSourceResponse(chat_service.stream_completion(request.messages))


@app.post("/elicitation/respond")
async def respond_to_elicitation(request: ElicitationResponse):
    """
    Respond to a pending elicitation request.

    Called by frontend when user provides input for a tool's elicitation.
    """
    success = await elicitation_service.respond(
        request.elicitation_id,
        request.response,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Elicitation not found")
    return {"status": "ok"}


@app.get("/tools")
async def list_tools():
    """List available MCP tools."""
    tools = await mcp_client.get_tools()
    return {"tools": tools}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
