export const CHANNEL_CATEGORIES = [
  "technology", "education", "entertainment", "gaming",
  "music", "news", "sports", "science", "lifestyle", "other",
] as const;

export type ChannelCategory = typeof CHANNEL_CATEGORIES[number];

export const CHANNEL_LANGUAGES = [
  "en", "uz", "ru", "ko", "ja", "zh",
  "es", "fr", "de", "hi", "ar", "pt", "other",
] as const;

export type ChannelLanguage = typeof CHANNEL_LANGUAGES[number];
