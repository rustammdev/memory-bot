import { requireChannel } from "./channel.helpers";
import { getChannelAgent } from "../agent/create";
import { recallMemories, saveConversation } from "../memory/client";
import { createLogger } from "../lib/logger";
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

  saveConversation(
    [
      { role: "user", content: request.message },
      { role: "assistant", content: reply },
    ],
    memoryCtx,
  )
    .then(() => log.debug("memory saved", { userId: request.userId }))
    .catch((err) => {
      log.error("memory save failed", { err: String(err) });
    });

  done();
  return {
    channelName: channel.name,
    handle: channel.username,
    reply,
  };
}
