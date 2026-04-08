import { requireChannel } from "./channel.helpers";
import { getChannelAgent } from "../agent/channel/create";
import { getMultiChannelAgent } from "../agent/multi/create";
import { findByUsernames } from "../repositories/channel.repo";
import { recallMemories, saveConversation } from "../memory/client";
import { createLogger } from "../lib/logger";
import { runInBackground } from "../lib/concurrency";
import { ValidationError } from "../lib/errors";
import type { ChatMessage } from "../types/chat";
import type { SseEvent, VideoSource } from "../lib/sse";

const log = createLogger("chat");

interface ChatRequest {
  readonly channel: string;
  readonly message: string;
  readonly userId: string;
  readonly history?: ReadonlyArray<ChatMessage>;
}

interface ChatResponse {
  readonly channelName: string;
  readonly handle: string;
  readonly reply: string;
}

export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const done = log.time(`chat [${request.channel}]`);
  const channel = await requireChannel(request.channel);

  const memoryCtx = {
    userId: request.userId,
    agentId: channel.id,
  };

  const recallDone = log.time("memory recall");
  const [memoryContext, agent] = await Promise.all([
    recallMemories(request.message, memoryCtx),
    getChannelAgent(channel),
  ]);
  recallDone();

  log.debug("memory context", { found: memoryContext.length > 0 });

  const memoryMessages: ChatMessage[] = memoryContext
    ? [{ role: "assistant", content: memoryContext }]
    : [];

  const messages: ChatMessage[] = [
    ...memoryMessages,
    ...(request.history ?? []),
    { role: "user", content: request.message },
  ];

  const agentDone = log.time("agent invoke");
  const result = await agent.invoke({ messages });
  agentDone();

  const lastMessage = result.messages.at(-1);
  const reply =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : "I could not generate a response. Please try again.";

  runInBackground(
    () => saveConversation(
      [
        { role: "user", content: request.message },
        { role: "assistant", content: reply },
      ],
      memoryCtx,
    ),
    { label: `memory[${request.userId}]`, retries: 3 },
  );

  done();
  return {
    channelName: channel.name,
    handle: channel.username,
    reply,
  };
}

interface MultiChatRequest {
  readonly channels: ReadonlyArray<string>;
  readonly message: string;
  readonly userId: string;
  readonly history?: ReadonlyArray<ChatMessage>;
}

interface MultiChatResponse {
  readonly channels: ReadonlyArray<{ readonly name: string; readonly handle: string }>;
  readonly reply: string;
}

const MULTI_AGENT_ID = "agent:multi";
const MAX_CHANNELS = 10;
const MIN_CHANNELS = 2;

export async function multiChat(
  request: MultiChatRequest,
): Promise<MultiChatResponse> {
  const done = log.time(`multiChat [${request.channels.length} channels]`);

  if (request.channels.length < MIN_CHANNELS) {
    throw new ValidationError(`At least ${MIN_CHANNELS} channels required`);
  }
  if (request.channels.length > MAX_CHANNELS) {
    throw new ValidationError(`Maximum ${MAX_CHANNELS} channels allowed`);
  }

  const channels = await findByUsernames(request.channels);
  if (channels.length === 0) {
    throw new ValidationError("No matching channels found");
  }

  const resolvedUsernames = new Set(channels.map((ch) => ch.username));
  const missing = request.channels.filter((u) => !resolvedUsernames.has(u));
  if (missing.length > 0) {
    throw new ValidationError(`Channels not found: ${missing.join(", ")}`);
  }

  const memoryCtx = {
    userId: request.userId,
    agentId: MULTI_AGENT_ID,
  };

  const recallDone = log.time("multi memory recall");
  const [memoryContext, agent] = await Promise.all([
    recallMemories(request.message, memoryCtx),
    getMultiChannelAgent(channels),
  ]);
  recallDone();

  log.debug("multi memory context", { found: memoryContext.length > 0 });

  const memoryMessages: ChatMessage[] = memoryContext
    ? [{ role: "assistant", content: memoryContext }]
    : [];

  const messages: ChatMessage[] = [
    ...memoryMessages,
    ...(request.history ?? []),
    { role: "user", content: request.message },
  ];

  const agentDone = log.time("multi agent invoke");
  const result = await agent.invoke({ messages });
  agentDone();

  const lastMessage = result.messages.at(-1);
  const reply =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : "I could not generate a response. Please try again.";

  runInBackground(
    () => saveConversation(
      [
        { role: "user", content: request.message },
        { role: "assistant", content: reply },
      ],
      memoryCtx,
    ),
    { label: `multi-memory[${request.userId}]`, retries: 3 },
  );

  done();
  return {
    channels: channels.map((ch) => ({ name: ch.name, handle: ch.username })),
    reply,
  };
}

// ─── Agent event mapping ──────────────────────────────────────────────────────

interface AgentStreamEvent {
  readonly event: string;
  readonly name: string;
  readonly data: {
    readonly chunk?: {
      readonly content?: unknown;
      readonly tool_call_chunks?: ReadonlyArray<unknown>;
      readonly additional_kwargs?: { readonly reasoning_content?: unknown };
    };
    readonly input?: Record<string, unknown>;
    readonly output?: unknown;
  };
}

// ─── Source extraction ────────────────────────────────────────────────────────

function parseToolSources(
  toolName: string,
  input: Record<string, unknown> | undefined,
  output: unknown,
): ReadonlyArray<VideoSource> {
  const text = typeof output === "string" ? output : "";

  switch (toolName) {
    case "list_videos":
    case "list_channel_videos": {
      const sources: VideoSource[] = [];
      const re = /\*\*(.+?)\*\*.*?\n\s+ID:\s+`([^`]+)`/gs;
      let m;
      while ((m = re.exec(text)) !== null && sources.length < 5) {
        const title = m[1]?.trim();
        const videoId = m[2]?.trim();
        if (title && videoId) sources.push({ title, videoId });
      }
      return sources;
    }

    case "semantic_search": {
      const sources: VideoSource[] = [];
      const seen = new Set<string>();
      const re = /\*\*(.+?)\*\* — \d+% match/g;
      let m;
      while ((m = re.exec(text)) !== null && sources.length < 3) {
        const title = m[1]?.trim();
        if (title && !seen.has(title)) { seen.add(title); sources.push({ title, videoId: "" }); }
      }
      return sources;
    }

    case "cross_channel_search": {
      const sources: VideoSource[] = [];
      const seen = new Set<string>();
      const sectionRe = /### (.+?)\n([\s\S]+?)(?=\n### |$)/g;
      let sec;
      while ((sec = sectionRe.exec(text)) !== null) {
        const channelName = sec[1]?.trim() ?? "";
        const body = sec[2] ?? "";
        const vidRe = /\*\*(.+?)\*\* — \d+% match/g;
        let v;
        while ((v = vidRe.exec(body)) !== null && sources.length < 6) {
          const title = v[1]?.trim();
          if (!title) continue;
          const key = `${channelName}::${title}`;
          if (!seen.has(key)) { seen.add(key); sources.push({ title, videoId: "", channelName }); }
        }
      }
      return sources;
    }

    case "get_transcript": {
      const videoId = typeof input?.videoId === "string" ? input.videoId : "";
      return videoId ? [{ title: "", videoId }] : [];
    }

    default:
      return [];
  }
}

function deduplicateSources(sources: ReadonlyArray<VideoSource>): ReadonlyArray<VideoSource> {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.videoId || s.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapAgentEvent(raw: AgentStreamEvent): SseEvent | null {
  switch (raw.event) {
    case "on_chat_model_stream": {
      const chunk = raw.data.chunk;
      if (!chunk) return null;

      // Thinking — only if model supports it (e.g. deepseek-reasoner)
      const thinking = chunk.additional_kwargs?.reasoning_content;
      if (typeof thinking === "string" && thinking.length > 0) {
        return { type: "thinking", text: thinking };
      }

      // Regular token — skip tool-call decision chunks
      const hasToolCalls = (chunk.tool_call_chunks?.length ?? 0) > 0;
      if (typeof chunk.content === "string" && chunk.content.length > 0 && !hasToolCalls) {
        return { type: "token", text: chunk.content };
      }

      return null;
    }

    case "on_tool_start":
      return { type: "tool_start", name: raw.name, input: raw.data.input ?? {} };

    case "on_tool_end":
      return { type: "tool_end", name: raw.name };

    default:
      return null;
  }
}

// ─── Streaming generators ─────────────────────────────────────────────────────

export async function* chatStream(
  request: ChatRequest,
): AsyncGenerator<SseEvent> {
  const channel = await requireChannel(request.channel);
  const memoryCtx = { userId: request.userId, agentId: channel.id };

  const [memoryContext, agent] = await Promise.all([
    recallMemories(request.message, memoryCtx),
    getChannelAgent(channel),
  ]);

  const memoryMessages: ChatMessage[] = memoryContext
    ? [{ role: "assistant", content: memoryContext }]
    : [];

  const messages: ChatMessage[] = [
    ...memoryMessages,
    ...(request.history ?? []),
    { role: "user", content: request.message },
  ];

  let fullReply = "";
  const rawSources: VideoSource[] = [];

  for await (const raw of agent.streamEvents({ messages }, { version: "v2" })) {
    if (raw.event === "on_tool_end") {
      const e = raw as AgentStreamEvent;
      rawSources.push(...parseToolSources(e.name, e.data.input, e.data.output));
    }
    const event = mapAgentEvent(raw as AgentStreamEvent);
    if (!event) continue;
    if (event.type === "token") fullReply += event.text;
    yield event;
  }

  const sources = deduplicateSources(rawSources);
  if (sources.length > 0) yield { type: "sources", videos: sources };
  yield { type: "done" };

  runInBackground(
    () => saveConversation(
      [
        { role: "user", content: request.message },
        { role: "assistant", content: fullReply || "No response generated." },
      ],
      memoryCtx,
    ),
    { label: `memory[${request.userId}]`, retries: 3 },
  );
}

export async function* multiChatStream(
  request: MultiChatRequest,
): AsyncGenerator<SseEvent> {
  if (request.channels.length < MIN_CHANNELS) {
    throw new ValidationError(`At least ${MIN_CHANNELS} channels required`);
  }
  if (request.channels.length > MAX_CHANNELS) {
    throw new ValidationError(`Maximum ${MAX_CHANNELS} channels allowed`);
  }

  const channels = await findByUsernames(request.channels);
  if (channels.length === 0) throw new ValidationError("No matching channels found");

  const resolvedUsernames = new Set(channels.map((ch) => ch.username));
  const missing = request.channels.filter((u) => !resolvedUsernames.has(u));
  if (missing.length > 0) {
    throw new ValidationError(`Channels not found: ${missing.join(", ")}`);
  }

  const memoryCtx = { userId: request.userId, agentId: MULTI_AGENT_ID };

  const [memoryContext, agent] = await Promise.all([
    recallMemories(request.message, memoryCtx),
    getMultiChannelAgent(channels),
  ]);

  const memoryMessages: ChatMessage[] = memoryContext
    ? [{ role: "assistant", content: memoryContext }]
    : [];

  const messages: ChatMessage[] = [
    ...memoryMessages,
    ...(request.history ?? []),
    { role: "user", content: request.message },
  ];

  let fullReply = "";
  const rawSources: VideoSource[] = [];

  for await (const raw of agent.streamEvents({ messages }, { version: "v2" })) {
    if (raw.event === "on_tool_end") {
      const e = raw as AgentStreamEvent;
      rawSources.push(...parseToolSources(e.name, e.data.input, e.data.output));
    }
    const event = mapAgentEvent(raw as AgentStreamEvent);
    if (!event) continue;
    if (event.type === "token") fullReply += event.text;
    yield event;
  }

  const sources = deduplicateSources(rawSources);
  if (sources.length > 0) yield { type: "sources", videos: sources };
  yield { type: "done" };

  runInBackground(
    () => saveConversation(
      [
        { role: "user", content: request.message },
        { role: "assistant", content: fullReply || "No response generated." },
      ],
      memoryCtx,
    ),
    { label: `multi-memory[${request.userId}]`, retries: 3 },
  );
}
