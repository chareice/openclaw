import type { OpenClawPluginApi } from "openclaw/plugin-sdk/llm-task";
import { createChannelTool } from "./src/create-channel-tool.js";
import { getWeatherTool } from "./src/get-weather-tool.js";
import { appendKnowledgeNoteTool } from "./src/append-knowledge-note-tool.js";
import { createKnowledgeNoteTool } from "./src/create-knowledge-note-tool.js";
import { moveChannelToCategoryTool } from "./src/move-channel-to-category-tool.js";
import { readKnowledgeNoteTool } from "./src/read-knowledge-note-tool.js";
import { searchKnowledgeTool } from "./src/search-knowledge-tool.js";

export default function register(api: OpenClawPluginApi) {
  api.registerTool((ctx) => createChannelTool(api, ctx), { optional: false });
  api.registerTool((ctx) => getWeatherTool(api, ctx), { optional: false });
  api.registerTool((ctx) => moveChannelToCategoryTool(api, ctx), { optional: false });
  api.registerTool((ctx) => searchKnowledgeTool(api, ctx), { optional: false });
  api.registerTool((ctx) => readKnowledgeNoteTool(api, ctx), { optional: false });
  api.registerTool((ctx) => createKnowledgeNoteTool(api, ctx), { optional: false });
  api.registerTool((ctx) => appendKnowledgeNoteTool(api, ctx), { optional: false });
}
