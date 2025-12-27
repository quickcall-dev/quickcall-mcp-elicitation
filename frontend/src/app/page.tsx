"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Types for the chat and elicitation system.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
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
    <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-4 my-3 shadow-sm">
      <p className="text-teal-800 font-medium mb-3 text-sm">{request.message}</p>

      {request.options ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {request.options.map((option) => (
              <button
                key={option}
                onClick={() => handleOptionClick(option)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  selectedOptions.includes(option)
                    ? "bg-teal-500 text-white shadow-sm"
                    : "bg-white text-teal-700 border border-teal-200 hover:bg-teal-100 hover:border-teal-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          {isArray && selectedOptions.length > 0 && (
            <button
              onClick={handleSubmitArray}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors shadow-sm"
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
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
          />
          <button
            onClick={handleSubmitText}
            disabled={!textInput.trim()}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Chat message bubble - styled like QuickCall.
 */
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200/50 rounded-3xl px-4 py-3 shadow-sm">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white ring-2 ring-teal-200 flex items-center justify-center shadow-sm">
        <span className="text-teal-600 font-semibold text-sm">q</span>
      </div>
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white border border-gray-100 rounded-3xl px-4 py-3 shadow-sm">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Logo component matching QuickCall style.
 */
function Logo() {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xl font-medium tracking-tight text-teal-600">quick</span>
      <span className="text-xl font-medium tracking-tight text-gray-900">call</span>
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
  }, [messages, streamingContent]);

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
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: accumulatedContent },
              ]);
              setStreamingContent("");
            }
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "tool_start") {
              addFlowEvent("mcp", `Tool: ${parsed.name}`, JSON.stringify(parsed.args));
            } else if (parsed.type === "elicitation_request") {
              addFlowEvent("elicitation", "Input needed", parsed.message);
              setElicitation(parsed as ElicitationRequest);
            } else if (parsed.type === "tool_result") {
              addFlowEvent("tool_result", `Completed: ${parsed.name}`, "Success");
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
          { role: "assistant", content: accumulatedContent },
        ]);
        setStreamingContent("");
      }
    } catch (error) {
      console.error("Chat error:", error);
      addFlowEvent("backend", "Error occurred", String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Flow Panel - Left Sidebar */}
      <div className="w-72 bg-white border-r border-gray-200 p-4 flex flex-col shadow-sm">
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Demo</h3>
          <p className="text-lg font-semibold text-gray-900">MCP Elicitation</p>
        </div>
        <FlowPanel events={flowEvents} />
      </div>

      {/* Chat Panel - Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Logo />
            <div className="h-6 w-px bg-gray-200" />
            <p className="text-sm text-gray-500">Meeting Scheduler Demo</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
              Interactive
            </span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 && !streamingContent ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 mb-2 font-medium">
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
                  <ChatMessage key={idx} message={msg} />
                ))}
                {streamingContent && (
                  <ChatMessage
                    message={{ role: "assistant", content: streamingContent }}
                  />
                )}
                {elicitation && (
                  <ElicitationDialog
                    request={elicitation}
                    onRespond={handleElicitationResponse}
                  />
                )}
                {isLoading && !streamingContent && !elicitation && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white ring-2 ring-teal-200 flex items-center justify-center shadow-sm">
                      <span className="text-teal-600 font-semibold text-sm">q</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
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

        {/* Input - Glass morphism style */}
        <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200 px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-center bg-white rounded-full border border-gray-200 shadow-sm px-4 py-2 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent transition-shadow">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                disabled={isLoading || !!elicitation}
                className="flex-1 bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50 text-sm py-1"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || !!elicitation}
                className="w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
