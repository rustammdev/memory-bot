import { channelRoutes } from "./channel.routes";
import { transcriptRoutes } from "./transcript.routes";
import { searchRoutes } from "./search.routes";
import { chatRoutes } from "./chat.routes";

export function createRoutes() {
  return {
    ...channelRoutes,
    ...transcriptRoutes,
    ...searchRoutes,
    ...chatRoutes,
  };
}
