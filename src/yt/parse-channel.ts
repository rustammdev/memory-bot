export function parseChannelInput(input: string): string {
  const trimmed = input.trim();

  // Full URL: https://www.youtube.com/@CalebWritesCode
  if (trimmed.startsWith("http")) {
    const url = trimmed.replace(/\/+$/, "");
    return url.endsWith("/videos") ? url : `${url}/videos`;
  }

  // Handle: @CalebWritesCode
  if (trimmed.startsWith("@")) {
    return `https://www.youtube.com/${trimmed}/videos`;
  }

  // Plain: CalebWritesCode
  return `https://www.youtube.com/@${trimmed}/videos`;
}
