CREATE TYPE channel_category AS ENUM (
  'technology',
  'education',
  'entertainment',
  'gaming',
  'music',
  'news',
  'sports',
  'science',
  'lifestyle',
  'other'
);

CREATE TYPE channel_language AS ENUM (
  'en', 'uz', 'ru', 'ko', 'ja',
  'zh', 'es', 'fr', 'de', 'hi',
  'ar', 'pt', 'other'
);
