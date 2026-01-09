"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";

// Theme context
const ThemeContext = createContext<{
  isDark: boolean;
  toggle: () => void;
}>({ isDark: true, toggle: () => {} });

const useTheme = () => useContext(ThemeContext);

// QuickCall brand colors
const themes = {
  dark: {
    bg: "#161b22",
    bgAlt: "#0d1117",
    border: "#30363d",
    text: "#e6edf3",
    textMuted: "#8b949e",
    accent: "#14b8a6",  // QuickCall teal
    accentLight: "#5eead4",
  },
  light: {
    bg: "#f8fafc",
    bgAlt: "#ffffff",
    border: "#e2e8f0",
    text: "#1e293b",
    textMuted: "#64748b",
    accent: "#0d9488",  // QuickCall teal (darker for light mode)
    accentLight: "#14b8a6",
  },
};

/**
 * Theme toggle button
 */
function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-lg transition-colors ${
        isDark
          ? "bg-[#21262d] hover:bg-[#30363d] text-gray-400"
          : "bg-gray-100 hover:bg-gray-200 text-gray-600"
      }`}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

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

// ASCII Art for QUICKCALL using 3D FIGlet font
const QUICKCALL_ASCII = `   ███████    ██     ██ ██   ██████  ██   ██   ██████      ██     ██       ██
  ██░░░░░██  ░██    ░██░██  ██░░░░██░██  ██   ██░░░░██    ████   ░██      ░██
 ██     ░░██ ░██    ░██░██ ██    ░░ ░██ ██   ██    ░░    ██░░██  ░██      ░██
░██      ░██ ░██    ░██░██░██       ░████   ░██         ██  ░░██ ░██      ░██
░██    ██░██ ░██    ░██░██░██       ░██░██  ░██        ██████████░██      ░██
░░██  ░░ ██  ░██    ░██░██░░██    ██░██░░██ ░░██    ██░██░░░░░░██░██      ░██
 ░░███████ ██░░███████ ░██ ░░██████ ░██ ░░██ ░░██████ ░██     ░██░████████░████████
  ░░░░░░░ ░░  ░░░░░░░  ░░   ░░░░░░  ░░   ░░   ░░░░░░  ░░      ░░ ░░░░░░░░ ░░░░░░░░`;

/**
 * QuickCall Terminal Header - Compact version
 */
function TerminalHeader() {
  const { isDark } = useTheme();

  return (
    <div className="flex justify-center px-4 pt-4">
      <div
        className="relative rounded-xl overflow-hidden px-12 py-10 w-full max-w-2xl"
        style={{
          backgroundColor: '#0d1117',
          boxShadow: isDark ? '0 8px 24px -8px rgba(0, 0, 0, 0.5)' : '0 4px 16px -4px rgba(0, 0, 0, 0.12)',
        }}
      >
        {/* Main ASCII text */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden">
          <pre
            className="text-[6px] sm:text-[8px] md:text-[10px] leading-none whitespace-pre"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              background: 'linear-gradient(180deg, #5eead4 0%, #14b8a6 50%, #0d9488 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 10px rgba(20, 184, 166, 0.6))',
            }}
          >
            {QUICKCALL_ASCII}
          </pre>
        </div>

        {/* Decorative divider */}
        <div className="flex items-center justify-center gap-4 mt-6 mb-3">
          <div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-transparent via-[#14b8a6]/50 to-transparent" />
          <div className="w-2 h-2 rotate-45 bg-[#14b8a6]" />
          <div className="h-px flex-1 max-w-[100px] bg-gradient-to-l from-transparent via-[#14b8a6]/50 to-transparent" />
        </div>

        {/* Subtitle */}
        <div className="text-center">
          <p className="font-mono text-gray-400 tracking-[0.2em] text-xs sm:text-sm">
            MCP Elicitation Demo
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Flow visualization panel showing the request chain - Terminal style
 */
function FlowPanel({ events }: { events: FlowEvent[] }) {
  const { isDark } = useTheme();
  const theme = isDark ? themes.dark : themes.light;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const getEventStyle = (type: FlowEvent["type"]) => {
    switch (type) {
      case "user":
        return { color: theme.accent, prefix: "USR" };
      case "backend":
        return { color: "#58a6ff", prefix: "API" };
      case "mcp":
        return { color: "#d2a8ff", prefix: "MCP" };
      case "elicitation":
        return { color: "#ffa657", prefix: "ELI" };
      case "tool_result":
        return { color: "#7ee787", prefix: "RES" };
      default:
        return { color: theme.textMuted, prefix: "---" };
    }
  };

  return (
    <div className="flex flex-col h-full font-mono">
      <div className="text-sm mb-4 flex items-center gap-2" style={{ color: theme.accent }}>
        <span style={{ color: theme.textMuted }}>$</span> request-flow --watch
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 text-sm">
        {events.length === 0 ? (
          <p style={{ color: theme.textMuted }}>
            <span style={{ color: theme.textMuted }}>// </span>awaiting input...
          </p>
        ) : (
          events.map((event) => {
            const style = getEventStyle(event.type);
            return (
              <div key={event.id} className="flex items-start gap-2">
                <span className="font-bold" style={{ color: style.color }}>[{style.prefix}]</span>
                <div className="flex-1 min-w-0">
                  <span style={{ color: theme.text }}>{event.label}</span>
                  {event.detail && (
                    <span className="ml-2 truncate block text-xs" style={{ color: theme.textMuted }}>{event.detail}</span>
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
 * JSON syntax highlighting component - Terminal colors
 */
function JsonSyntax({ data }: { data: Record<string, unknown> | null }) {
  const { isDark } = useTheme();

  // Theme-aware syntax colors
  const colors = isDark
    ? {
        key: "#7ee787",      // green
        string: "#a5d6ff",   // light blue
        number: "#79c0ff",   // blue
        boolean: "#d2a8ff",  // purple
        punctuation: "#8b949e", // gray
      }
    : {
        key: "#166534",      // dark green
        string: "#1e40af",   // dark blue
        number: "#0369a1",   // darker blue
        boolean: "#7c3aed",  // purple
        punctuation: "#64748b", // slate
      };

  if (!data) return null;

  const formatValue = (value: unknown, indent: number = 0): React.ReactNode => {
    const indentStr = "  ".repeat(indent);

    if (value === null) {
      return <span style={{ color: colors.punctuation }}>null</span>;
    }
    if (typeof value === "boolean") {
      return <span style={{ color: colors.boolean }}>{value.toString()}</span>;
    }
    if (typeof value === "number") {
      return <span style={{ color: colors.number }}>{value}</span>;
    }
    if (typeof value === "string") {
      return <span style={{ color: colors.string }}>&quot;{value}&quot;</span>;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span style={{ color: colors.punctuation }}>[]</span>;
      return (
        <>
          <span style={{ color: colors.punctuation }}>[</span>
          {"\n"}
          {value.map((item, i) => (
            <span key={i}>
              {indentStr}  {formatValue(item, indent + 1)}
              {i < value.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {indentStr}<span style={{ color: colors.punctuation }}>]</span>
        </>
      );
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return <span style={{ color: colors.punctuation }}>{"{}"}</span>;
      return (
        <>
          <span style={{ color: colors.punctuation }}>{"{"}</span>
          {"\n"}
          {entries.map(([k, v], i) => (
            <span key={k}>
              {indentStr}  <span style={{ color: colors.key }}>&quot;{k}&quot;</span>
              <span style={{ color: colors.punctuation }}>: </span>
              {formatValue(v, indent + 1)}
              {i < entries.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {indentStr}<span style={{ color: colors.punctuation }}>{"}"}</span>
        </>
      );
    }
    return <span style={{ color: colors.punctuation }}>{String(value)}</span>;
  };

  return <>{formatValue(data)}</>;
}

/**
 * Tool call card - Terminal style
 */
function ToolCallCard({ tool, isExpanded, onToggle }: {
  tool: ToolCall;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { isDark } = useTheme();
  const theme = isDark ? themes.dark : themes.light;
  const inputKeys = ["title", "participants", "duration", "scheduled_time"];
  const outputKeys = ["success", "meeting_id", "message"];

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
    <div
      className="rounded-lg overflow-hidden font-mono text-xs border"
      style={{ backgroundColor: theme.bgAlt, borderColor: theme.border }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 transition-colors hover:opacity-80"
      >
        <span style={{ color: tool.status === "completed" ? (isDark ? "#7ee787" : "#166534") : "#ffa657" }}>
          {tool.status === "completed" ? "✓" : "◐"}
        </span>
        <span className="flex-1 text-left" style={{ color: isDark ? "#d2a8ff" : "#7c3aed" }}>{tool.name}</span>
        <span style={{ color: theme.textMuted }}>{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && (
        <div className="border-t" style={{ borderColor: theme.border }}>
          {hasArgs && (
            <div className="px-3 py-2">
              <p style={{ color: theme.textMuted }} className="mb-1">// args</p>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                <JsonSyntax data={inputParams} />
              </pre>
            </div>
          )}
          {hasResult && (
            <div className="px-3 py-2 border-t" style={{ borderColor: theme.border }}>
              <p style={{ color: theme.textMuted }} className="mb-1">// result</p>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                <JsonSyntax data={resultOutput} />
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Elicitation dialog - Terminal style
 */
function ElicitationDialog({
  request,
  onRespond,
}: {
  request: ElicitationRequest;
  onRespond: (response: Record<string, unknown>) => void;
}) {
  const { isDark } = useTheme();
  const theme = isDark ? themes.dark : themes.light;
  // Prefill with "quick call syncup" for meeting title elicitation
  const isTitle = request.message.toLowerCase().includes("called") || request.message.toLowerCase().includes("title");
  const [textInput, setTextInput] = useState(isTitle ? "quick call syncup" : "");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and place cursor at end
    if (inputRef.current && !request.options) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(textInput.length, textInput.length);
    }
  }, []);

  const schema = request.schema;
  const properties = (schema?.properties || {}) as Record<string, Record<string, unknown>>;
  const fieldName = Object.keys(properties)[0] || "value";
  const fieldSchema = properties[fieldName] || {};
  // Force multi-select for participants question
  const isParticipants = request.message.toLowerCase().includes("attend") || request.message.toLowerCase().includes("participant");
  const isArray = fieldSchema.type === "array" || isParticipants;

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
      // Send as comma-separated string for MCP server compatibility
      onRespond({ value: selectedOptions.join(", ") });
    }
  };

  const handleSubmitText = () => {
    if (textInput.trim()) {
      onRespond({ value: textInput.trim() });
    }
  };

  return (
    <div
      className="border rounded-lg p-4 my-3 font-mono"
      style={{ backgroundColor: theme.bgAlt, borderColor: "#ffa65730" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: "#ffa657" }}>[ELICIT]</span>
        <span className="text-sm" style={{ color: theme.text }}>{request.message}</span>
      </div>

      {request.options ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {request.options.map((option, idx) => (
              <button
                key={option}
                onClick={() => handleOptionClick(option)}
                className="px-3 py-1.5 rounded text-xs transition-all border"
                style={{
                  backgroundColor: selectedOptions.includes(option) ? theme.accent : theme.bg,
                  color: selectedOptions.includes(option) ? theme.bgAlt : theme.text,
                  borderColor: selectedOptions.includes(option) ? theme.accent : theme.border,
                }}
              >
                <span style={{ color: theme.textMuted }} className="mr-1">[{idx + 1}]</span>
                {option}
              </button>
            ))}
          </div>
          {isArray && selectedOptions.length > 0 && (
            <button
              onClick={handleSubmitArray}
              className="px-4 py-2 rounded text-xs font-bold transition-colors"
              style={{ backgroundColor: theme.accent, color: theme.bgAlt }}
            >
              confirm ({selectedOptions.length})
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2 items-center">
          <span style={{ color: theme.accent }}>$</span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitText()}
              placeholder="type response..."
              className="w-full bg-transparent border-b focus:outline-none text-sm py-1 transition-colors caret-transparent"
              style={{ color: theme.text, borderColor: theme.border }}
            />
            {/* Blinking block cursor */}
            <span
              className="absolute top-1/2 -translate-y-1/2 w-2 h-4 animate-pulse pointer-events-none"
              style={{ left: `${textInput.length * 0.55}em`, backgroundColor: theme.accent }}
            />
          </div>
          <button
            onClick={handleSubmitText}
            disabled={!textInput.trim()}
            className="disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ color: theme.accent }}
          >
            ⏎
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Assistant avatar - "q" logo
 */
function AssistantAvatar() {
  const { isDark } = useTheme();
  const theme = isDark ? themes.dark : themes.light;
  return (
    <div
      className="flex-shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center"
      style={{ backgroundColor: theme.bgAlt, borderColor: `${theme.accent}50` }}
    >
      <span className="font-semibold text-base" style={{ color: theme.accent }}>q</span>
    </div>
  );
}

/**
 * User avatar
 */
function UserAvatar() {
  const { isDark } = useTheme();
  const theme = isDark ? themes.dark : themes.light;
  return (
    <div
      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${theme.accent}, ${isDark ? '#38aa9f' : '#0f766e'})` }}
    >
      <svg className="w-5 h-5" fill={theme.bgAlt} viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

/**
 * Chat message - Clean style with avatars
 */
function ChatMessage({ message, toolCalls, expandedTools, onToggleTool }: {
  message: Message;
  toolCalls?: ToolCall[];
  expandedTools?: Set<string>;
  onToggleTool?: (id: string) => void;
}) {
  const { isDark } = useTheme();
  const theme = isDark ? themes.dark : themes.light;
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-3">
        <div
          className="max-w-[70%] rounded-2xl px-4 py-3 border"
          style={{ backgroundColor: theme.bgAlt, borderColor: theme.border }}
        >
          <p className="text-sm whitespace-pre-wrap" style={{ color: theme.text }}>{message.content}</p>
        </div>
        <UserAvatar />
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <AssistantAvatar />
      <div className="flex-1 max-w-[85%] space-y-3">
        {/* Tool calls */}
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
        {/* Message content */}
        {message.content && (
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: theme.text }}>{message.content}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Main application component - Terminal style
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
  const [isDark, setIsDark] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = useCallback(() => setIsDark(prev => !prev), []);
  const theme = isDark ? themes.dark : themes.light;

  // Auto-focus main input on mount
  useEffect(() => {
    mainInputRef.current?.focus();
  }, []);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8002";

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
    <ThemeContext.Provider value={{ isDark, toggle: toggleTheme }}>
      <div className="flex h-screen transition-colors duration-200" style={{ backgroundColor: theme.bg }}>
        {/* Flow Panel - Left Sidebar */}
        <div
          className="w-80 border-r p-5 flex flex-col transition-colors duration-200"
          style={{ backgroundColor: theme.bgAlt, borderColor: theme.border }}
        >
          <div className="mb-4 pb-4 border-b flex items-center justify-between" style={{ borderColor: theme.border }}>
            <div>
              <div className="flex items-center font-mono text-sm">
                <span style={{ color: theme.accent }}>quick</span>
                <span style={{ color: theme.text }}>call</span>
              </div>
              <p className="text-xs font-mono mt-1" style={{ color: theme.textMuted }}>mcp-elicitation v1.0</p>
            </div>
            <ThemeToggle />
          </div>
          <FlowPanel events={flowEvents} />
        </div>

        {/* Chat Panel - Main Area */}
        <div className="flex-1 flex flex-col transition-colors duration-200" style={{ backgroundColor: theme.bg }}>
          {/* Frozen Header with ASCII Art */}
          <TerminalHeader />

        {/* Messages - Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && !streamingContent ? (
              <div className="flex items-center justify-center h-full min-h-[300px]">
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full border flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: theme.bgAlt, borderColor: theme.border }}
                  >
                    <svg className="w-8 h-8" style={{ color: theme.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="mb-2 font-medium" style={{ color: theme.text }}>
                    Try: &quot;Schedule a meeting&quot;
                  </p>
                  <p className="text-sm max-w-sm" style={{ color: theme.textMuted }}>
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
                {/* Streaming content */}
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
                        <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: theme.text }}>
                          {streamingContent}
                          <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ backgroundColor: theme.accent }} />
                        </p>
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
                    <div className="flex items-center gap-2 text-sm py-2" style={{ color: theme.textMuted }}>
                      <svg className="w-4 h-4 animate-spin" style={{ color: theme.accent }} fill="none" viewBox="0 0 24 24">
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

        {/* Input - Clean visible input bar */}
        <div
          className="px-6 py-4 border-t transition-colors duration-200"
          style={{ backgroundColor: theme.bg, borderColor: theme.border }}
        >
          <div className="max-w-4xl mx-auto">
            <div
              className="flex gap-3 items-center rounded-2xl border px-4 py-3 transition-colors duration-200"
              style={{ backgroundColor: theme.bgAlt, borderColor: theme.border }}
            >
              <div className="flex-1 relative">
                <input
                  ref={mainInputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Send a message..."
                  disabled={isLoading || !!elicitation}
                  className="w-full bg-transparent focus:outline-none disabled:opacity-50 text-sm py-1 caret-transparent"
                  style={{ color: theme.text }}
                />
                {/* Blinking block cursor */}
                <span
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-4 animate-pulse pointer-events-none"
                  style={{ left: `${input.length * 0.55}em`, backgroundColor: theme.accent }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || !!elicitation}
                className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: theme.accent, color: theme.bgAlt }}
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
    </ThemeContext.Provider>
  );
}
