import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export function isValidChatMessage(value: unknown): value is ChatMessage {
  return chatMessageSchema.safeParse(value).success;
}

export const chatRequestSchema = z.object({
  channel: z.string().min(1, "channel is required"),
  message: z.string().min(1, "message is required"),
  userId: z.string().min(1, "userId is required"),
  history: z.array(chatMessageSchema).optional(),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

export const multiChatRequestSchema = z.object({
  channels: z.array(z.string()).min(1, "channels is required"),
  message: z.string().min(1, "message is required"),
  userId: z.string().min(1, "userId is required"),
  history: z.array(chatMessageSchema).optional(),
});

export type MultiChatRequestBody = z.infer<typeof multiChatRequestSchema>;
