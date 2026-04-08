import { requireChannel } from "./channel.helpers";
import { getChannelAgent } from "../agent/channel/create";
import { getMultiChannelAgent } from "../agent/multi/create";
import { findByUsernames } from "../repositories/channel.repo";
import { recallStructured, saveConversation } from "../memory/client";
import { createLogger } from "../lib/logger";
import { runInBackground } from "../lib/concurrency";
import { ValidationError } from "../lib/errors";
import type { ChatMessage } from "../types/chat";

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
  const memoryResult = await recallStructured(request.message, memoryCtx);
  recallDone();

  log.debug("memory context", {
    memories: memoryResult.memories.length > 0,
    profile: memoryResult.userProfile.length > 0,
  });

  const agent = await getChannelAgent(channel, memoryResult);

  const messages: ChatMessage[] = [
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
  const memoryResult = await recallStructured(request.message, memoryCtx);
  recallDone();

  log.debug("multi memory context", {
    memories: memoryResult.memories.length > 0,
    profile: memoryResult.userProfile.length > 0,
  });

  const agent = await getMultiChannelAgent(channels, memoryResult);

  const messages: ChatMessage[] = [
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
