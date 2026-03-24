import { extractUsername } from "./parse-channel";

export interface ChannelImages {
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
}

export async function fetchChannelImages(
  channelInput: string,
): Promise<ChannelImages> {
  const username = extractUsername(channelInput);
  const url = `https://www.youtube.com/${username}`;

  const response = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });

  if (!response.ok) {
    return { avatarUrl: null, bannerUrl: null };
  }

  const html = await response.text();

  const avatarUrl = extractAvatar(html);
  const bannerUrl = extractBanner(html);

  return { avatarUrl, bannerUrl };
}

function extractAvatar(html: string): string | null {
  const urls = html.match(
    /https:\/\/yt3\.googleusercontent\.com\/[^"=]+(?:=s\d+-[^"]+)/g,
  );
  if (!urls) return null;

  const largest = urls
    .filter((u) => /=s\d+/.test(u))
    .sort((a, b) => {
      const sizeA = Number(a.match(/=s(\d+)/)?.[1] ?? 0);
      const sizeB = Number(b.match(/=s(\d+)/)?.[1] ?? 0);
      return sizeB - sizeA;
    });

  return largest[0] ?? null;
}

function extractBanner(html: string): string | null {
  const urls = html.match(
    /https:\/\/yt3\.googleusercontent\.com\/[^"=]+(?:=w\d+-[^"]+)/g,
  );
  if (!urls) return null;

  const largest = urls
    .filter((u) => /=w\d+/.test(u))
    .sort((a, b) => {
      const widthA = Number(a.match(/=w(\d+)/)?.[1] ?? 0);
      const widthB = Number(b.match(/=w(\d+)/)?.[1] ?? 0);
      return widthB - widthA;
    });

  return largest[0] ?? null;
}
