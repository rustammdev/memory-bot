import { requireChannel } from "./channel.helpers";
import { getChannelAgent } from "../agent/create";
import { recallMemories, saveConversation } from "../memory/client";
import type { ChatMessage } from "../types/chat";

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
  const channel = await requireChannel(request.channel);

  const memoryCtx = {
    userId: request.userId,
    agentId: channel.id,
  };

  const memoryPromise = recallMemories(request.message, memoryCtx);
  const agent = getChannelAgent(channel);

  const memoryContext = await memoryPromise;

  const memoryMessages: ChatMessage[] = memoryContext
    ? [{ role: "assistant", content: memoryContext }]
    : [];

  const messages: ChatMessage[] = [
    ...memoryMessages,
    ...(request.history ?? []),
    { role: "user", content: request.message },
  ];

  const result = await agent.invoke({ messages });

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
  ).catch((err) => {
    console.error("[mem0] Failed to save conversation:", err);
  });

  return {
    channelName: channel.name,
    handle: channel.username,
    reply,
  };
}
