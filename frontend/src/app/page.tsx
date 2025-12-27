"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Types for the chat and elicitation system.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

interface ElicitationRequest {
  elicitation_id: string;
  message: string;
  options: string[] | null;
  schema: Record<string, unknown> | null;
}

interface FlowEvent {
  id: string;
  type: "user" | "backend" | "mcp" | "elicitation" | "tool_result";
  label: string;
  detail?: string;
  timestamp: Date;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "running" | "completed";
}

/**
 * Flow visualization panel showing the request chain.
 */
function FlowPanel({ events }: { events: FlowEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const getEventStyle = (type: FlowEvent["type"]) => {
    switch (type) {
      case "user":
        return { dot: "bg-teal-500", line: "bg-teal-200" };
      case "backend":
        return { dot: "bg-blue-500", line: "bg-blue-200" };
      case "mcp":
        return { dot: "bg-purple-500", line: "bg-purple-200" };
      case "elicitation":
        return { dot: "bg-amber-500", line: "bg-amber-200" };
      case "tool_result":
        return { dot: "bg-emerald-500", line: "bg-emerald-200" };
      default:
        return { dot: "bg-gray-400", line: "bg-gray-200" };
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Request Flow
      </h2>
      <div className="flex-1 overflow-y-auto space-y-1">
        {events.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Send a message to see the flow...
          </p>
        ) : (
          events.map((event, idx) => {
            const style = getEventStyle(event.type);
            return (
              <div key={event.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${style.dot} ring-2 ring-white shadow-sm`} />
                  {idx < events.length - 1 && (
                    <div className={`w-0.5 h-8 ${style.line}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <p className="text-sm font-medium text-gray-700">{event.label}</p>
                  {event.detail && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{event.detail}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

/**
 * JSON syntax highlighting component
 */
function JsonSyntax({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;

  const formatValue = (value: unknown, indent: number = 0): React.ReactNode => {
    const indentStr = "  ".repeat(indent);

    if (value === null) {
      return <span className="text-gray-400">null</span>;
    }
    if (typeof value === "boolean") {
      return <span className="text-purple-600">{value.toString()}</span>;
    }
    if (typeof value === "number") {
      return <span className="text-blue-600">{value}</span>;
    }
    if (typeof value === "string") {
      return <span className="text-emerald-600">&quot;{value}&quot;</span>;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-600">[]</span>;
      return (
        <>
          <span className="text-gray-600">[</span>
          {"\n"}
          {value.map((item, i) => (
            <span key={i}>
              {indentStr}  {formatValue(item, indent + 1)}
              {i < value.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {indentStr}<span className="text-gray-600">]</span>
        </>
      );
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return <span className="text-gray-600">{"{}"}</span>;
      return (
        <>
          <span className="text-gray-600">{"{"}</span>
          {"\n"}
          {entries.map(([k, v], i) => (
            <span key={k}>
              {indentStr}  <span className="text-amber-700">&quot;{k}&quot;</span>
              <span className="text-gray-600">: </span>
              {formatValue(v, indent + 1)}
              {i < entries.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {indentStr}<span className="text-gray-600">{"}"}</span>
        </>
      );
    }
    return <span className="text-gray-600">{String(value)}</span>;
  };

  return <>{formatValue(data)}</>;
}

/**
 * Tool call card - expandable like QuickCall with Arguments and Result sections
 */
function ToolCallCard({ tool, isExpanded, onToggle }: {
  tool: ToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Input fields are: title, participants, duration, scheduled_time
  // Meta/output fields are: success, meeting_id, message
  const inputKeys = ["title", "participants", "duration", "scheduled_time"];
  const outputKeys = ["success", "meeting_id", "message"];

  // Extract input arguments from result
  const getInputParams = (): Record<string, unknown> => {
    if (!tool.result) return tool.args;
    const params: Record<string, unknown> = {};
    for (const key of inputKeys) {
      if (key in tool.result && tool.result[key] !== undefined && tool.result[key] !== null) {
        params[key] = tool.result[key];
      }
    }
    return Object.keys(params).length > 0 ? params : tool.args;
  };

  // Result shows success/failure status
  const getResultOutput = (): Record<string, unknown> | null => {
    if (!tool.result) return null;
    const output: Record<string, unknown> = {};
    for (const key of outputKeys) {
      if (key in tool.result && tool.result[key] !== undefined) {
        output[key] = tool.result[key];
      }
    }
    return Object.keys(output).length > 0 ? output : null;
  };

  const inputParams = getInputParams();
  const resultOutput = getResultOutput();

  const hasArgs = Object.keys(inputParams).length > 0;
  const hasResult = resultOutput !== null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors"
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
          tool.status === "completed" ? "bg-emerald-100" : "bg-amber-100"
        }`}>
          {tool.status === "completed" ? (
            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <span className="text-sm font-medium text-gray-700 flex-1 text-left">{tool.name}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Arguments section */}
          {hasArgs && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Arguments</p>
              <div className="bg-white rounded-lg border border-gray-100 p-3">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  <JsonSyntax data={inputParams} />
                </pre>
              </div>
            </div>
          )}
          {/* Result section */}
          {hasResult && (
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Result</p>
              <div className="bg-white rounded-lg border border-gray-100 p-3">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  <JsonSyntax data={resultOutput} />
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Elicitation dialog for gathering user input - styled like QuickCall.
 */
function ElicitationDialog({
  request,
  onRespond,
}: {
  request: ElicitationRequest;
  onRespond: (response: Record<string, unknown>) => void;
}) {
  const [textInput, setTextInput] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const schema = request.schema;
  const properties = (schema?.properties || {}) as Record<string, Record<string, unknown>>;
  const fieldName = Object.keys(properties)[0] || "value";
  const fieldSchema = properties[fieldName] || {};
  const isArray = fieldSchema.type === "array";

  const handleOptionClick = (option: string) => {
    if (isArray) {
      setSelectedOptions((prev) =>
        prev.includes(option)
          ? prev.filter((o) => o !== option)
          : [...prev, option]
      );
    } else {
      onRespond({ value: option });
    }
  };

  const handleSubmitArray = () => {
    if (selectedOptions.length > 0) {
      onRespond({ value: selectedOptions });
    }
  };

  const handleSubmitText = () => {
    if (textInput.trim()) {
      onRespond({ value: textInput.trim() });
    }
  };

  return (
    <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4 my-3">
      <p className="text-gray-700 mb-3 text-sm">{request.message}</p>

      {request.options ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {request.options.map((option) => (
              <button
                key={option}
                onClick={() => handleOptionClick(option)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                  selectedOptions.includes(option)
                    ? "bg-teal-500 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-teal-300 hover:text-teal-600"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          {isArray && selectedOptions.length > 0 && (
            <button
              onClick={handleSubmitArray}
              className="px-4 py-2 bg-teal-500 text-white rounded-full text-sm font-medium hover:bg-teal-600 transition-colors"
            >
              Confirm Selection ({selectedOptions.length})
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitText()}
            placeholder="Type your response..."
            autoFocus
            className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-300 transition-colors"
          />
          <button
            onClick={handleSubmitText}
            disabled={!textInput.trim()}
            className="w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Assistant avatar - matches QuickCall style with larger "q"
 */
function AssistantAvatar() {
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white border-2 border-teal-200 flex items-center justify-center">
      <span className="text-teal-500 font-semibold text-base">q</span>
    </div>
  );
}

/**
 * User avatar - generic user icon
 */
function UserAvatar() {
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

/**
 * Chat message bubble - styled like QuickCall.
 * Assistant messages have NO rectangle, just plain text.
 * User messages have a rounded rectangle with subtle styling.
 */
function ChatMessage({ message, toolCalls, expandedTools, onToggleTool }: {
  message: Message;
  toolCalls?: ToolCall[];
  expandedTools?: Set<string>;
  onToggleTool?: (id: string) => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-3">
        <div className="max-w-[70%] bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
        </div>
        <UserAvatar />
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <AssistantAvatar />
      <div className="flex-1 max-w-[85%] space-y-3">
        {/* Tool calls shown above the message content */}
        {toolCalls && toolCalls.length > 0 && expandedTools && onToggleTool && (
          <div className="space-y-2">
            {toolCalls.map((tool) => (
              <ToolCallCard
                key={tool.id}
                tool={tool}
                isExpanded={expandedTools.has(tool.id)}
                onToggle={() => onToggleTool(tool.id)}
              />
            ))}
          </div>
        )}
        {/* Message content - no border/rectangle for assistant */}
        {message.content && (
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Logo component matching QuickCall style - one word, no space.
 */
function Logo() {
  return (
    <div className="flex items-center">
      <span className="text-xl font-medium tracking-tight text-teal-500">quick</span>
      <span className="text-xl font-medium tracking-tight text-gray-800">call</span>
    </div>
  );
}

/**
 * Main application component.
 */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("Schedule a meeting");
  const [isLoading, setIsLoading] = useState(false);
  const [flowEvents, setFlowEvents] = useState<FlowEvent[]>([]);
  const [elicitation, setElicitation] = useState<ElicitationRequest | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  const addFlowEvent = useCallback(
    (type: FlowEvent["type"], label: string, detail?: string) => {
      setFlowEvents((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type, label, detail, timestamp: new Date() },
      ]);
    },
    []
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, currentToolCalls]);

  const toggleToolExpanded = (toolId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const handleElicitationResponse = async (response: Record<string, unknown>) => {
    if (!elicitation) return;

    addFlowEvent("user", "User responded", JSON.stringify(response));

    try {
      await fetch(`${BACKEND_URL}/elicitation/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elicitation_id: elicitation.elicitation_id,
          response,
        }),
      });
      setElicitation(null);
    } catch (error) {
      console.error("Failed to respond to elicitation:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");

    // Create new messages array with user message
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    setStreamingContent("");
    setCurrentToolCalls([]);

    addFlowEvent("user", "User sent message", userMessage);
    addFlowEvent("backend", "Request to backend", "POST /chat");

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let toolCallsForMessage: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") {
            if (accumulatedContent) {
              // Attach tool calls to the assistant message
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: accumulatedContent,
                  toolCalls: toolCallsForMessage.length > 0 ? [...toolCallsForMessage] : undefined
                },
              ]);
              setStreamingContent("");
              setCurrentToolCalls([]);
            }
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "tool_start") {
              const toolId = crypto.randomUUID();
              addFlowEvent("mcp", `Tool: ${parsed.name}`, JSON.stringify(parsed.args));
              const newTool: ToolCall = {
                id: toolId,
                name: parsed.name,
                args: parsed.args || {},
                status: "running"
              };
              toolCallsForMessage = [...toolCallsForMessage, newTool];
              setCurrentToolCalls(toolCallsForMessage);
            } else if (parsed.type === "elicitation_request") {
              addFlowEvent("elicitation", "Input needed", parsed.message);
              setElicitation(parsed as ElicitationRequest);
            } else if (parsed.type === "tool_result") {
              addFlowEvent("tool_result", `Completed: ${parsed.name}`, "Success");
              // Update tool with result data
              toolCallsForMessage = toolCallsForMessage.map(t =>
                t.name === parsed.name
                  ? { ...t, status: "completed" as const, result: parsed.result }
                  : t
              );
              setCurrentToolCalls(toolCallsForMessage);
            } else if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              accumulatedContent += content;
              setStreamingContent(accumulatedContent);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // When stream ends, finalize any accumulated content
      if (accumulatedContent) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: accumulatedContent,
            toolCalls: toolCallsForMessage.length > 0 ? [...toolCallsForMessage] : undefined
          },
        ]);
        setStreamingContent("");
        setCurrentToolCalls([]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      addFlowEvent("backend", "Error occurred", String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Flow Panel - Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Demo</h3>
          <p className="text-lg font-semibold text-gray-900">MCP Elicitation</p>
        </div>
        <FlowPanel events={flowEvents} />
      </div>

      {/* Chat Panel - Main Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Header */}
        <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="h-5 w-px bg-gray-200" />
            <p className="text-sm text-gray-500">Meeting Scheduler Demo</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-600 border border-teal-200">
              Interactive
            </span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && !streamingContent ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 mb-2 font-medium">
                    Try: &quot;Schedule a meeting&quot;
                  </p>
                  <p className="text-gray-400 text-sm max-w-sm">
                    The AI will use elicitation to gather meeting details step by step
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <ChatMessage
                    key={idx}
                    message={msg}
                    toolCalls={msg.toolCalls}
                    expandedTools={expandedTools}
                    onToggleTool={toggleToolExpanded}
                  />
                ))}
                {/* Show streaming content with current tool calls */}
                {(streamingContent || currentToolCalls.length > 0) && (
                  <div className="flex gap-3 items-start">
                    <AssistantAvatar />
                    <div className="flex-1 max-w-[85%] space-y-3">
                      {currentToolCalls.length > 0 && (
                        <div className="space-y-2">
                          {currentToolCalls.map((tool) => (
                            <ToolCallCard
                              key={tool.id}
                              tool={tool}
                              isExpanded={expandedTools.has(tool.id)}
                              onToggle={() => toggleToolExpanded(tool.id)}
                            />
                          ))}
                        </div>
                      )}
                      {streamingContent && (
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
                      )}
                    </div>
                  </div>
                )}
                {elicitation && (
                  <div className="flex gap-3 items-start">
                    <AssistantAvatar />
                    <div className="flex-1 max-w-[85%]">
                      <ElicitationDialog
                        request={elicitation}
                        onRespond={handleElicitationResponse}
                      />
                    </div>
                  </div>
                )}
                {isLoading && !streamingContent && !elicitation && currentToolCalls.length === 0 && (
                  <div className="flex gap-3 items-start">
                    <AssistantAvatar />
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                      <svg className="w-4 h-4 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-center bg-white rounded-2xl border border-gray-200 px-4 py-2 focus-within:border-teal-300 transition-colors">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Send a message..."
                disabled={isLoading || !!elicitation}
                className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50 text-sm py-1"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || !!elicitation}
                className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
