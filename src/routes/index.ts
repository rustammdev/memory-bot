import { channelRoutes } from "./channel.routes";
import { transcriptRoutes } from "./transcript.routes";
import { searchRoutes } from "./search.routes";

export function createRoutes() {
  return {
    ...channelRoutes,
    ...transcriptRoutes,
    ...searchRoutes,
  };
}
