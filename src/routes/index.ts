import { channelRoutes } from "./channel.routes";
import { transcriptRoutes } from "./transcript.routes";

export function createRoutes() {
  return {
    ...channelRoutes,
    ...transcriptRoutes,
  };
}
