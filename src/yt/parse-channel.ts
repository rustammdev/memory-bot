export function extractUsername(input: string): string {
  const trimmed = input.trim();

  if (trimmed.startsWith("http")) {
    const match = trimmed.match(/@([^/]+)/);
    return match ? `@${match[1]}` : trimmed;
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function toChannelUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.startsWith("http")) {
    const url = trimmed.replace(/\/+$/, "");
    return url.endsWith("/videos") ? url : `${url}/videos`;
  }

  if (trimmed.startsWith("@")) {
    return `https://www.youtube.com/${trimmed}/videos`;
  }

  return `https://www.youtube.com/@${trimmed}/videos`;
}
