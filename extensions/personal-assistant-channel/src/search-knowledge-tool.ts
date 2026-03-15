import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/llm-task";
import {
  normalizeText,
  readPluginConfig,
  resolveTimeoutSignal,
  trimTrailingSlash,
} from "./plugin-config.js";

type KnowledgeNoteSummary = {
  excerpt?: string | null;
  folder_path?: string | null;
  id?: string;
  path?: string;
  title?: string;
  updated_at?: string;
};

type SearchKnowledgeResponse = {
  notes?: KnowledgeNoteSummary[];
  query?: string;
};

type SearchKnowledgeToolContext = {
  sessionKey?: string;
};

export function searchKnowledgeTool(api: OpenClawPluginApi, ctx: SearchKnowledgeToolContext) {
  return {
    name: "search_knowledge",
    label: "Search Knowledge",
    description:
      "Search the user's knowledge vault for matching notes by title, folder, or content. Use this before reading or updating an existing note when you do not already know the note id.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query for the note title, path, or body.",
        minLength: 1,
        maxLength: 120,
      }),
      limit: Type.Optional(
        Type.Integer({
          description: "Maximum number of matching notes to return.",
          minimum: 1,
          maximum: 10,
        }),
      ),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const sessionKey = normalizeText(ctx.sessionKey);

      if (!sessionKey) {
        throw new Error("search_knowledge requires an active session");
      }

      const query = normalizeText(params.query);

      if (!query) {
        throw new Error("query required");
      }

      const limit = typeof params.limit === "number" ? Math.trunc(params.limit) : undefined;
      const pluginConfig = readPluginConfig(api);

      if (!pluginConfig.assistantApiBaseUrl) {
        throw new Error("personal-assistant-channel missing assistantApiBaseUrl");
      }

      if (!pluginConfig.assistantApiToken) {
        throw new Error("personal-assistant-channel missing assistantApiToken");
      }

      const timeoutMs = pluginConfig.requestTimeoutMs ?? 10_000;
      const response = await requestSearchKnowledge({
        assistantApiBaseUrl: pluginConfig.assistantApiBaseUrl,
        assistantApiToken: pluginConfig.assistantApiToken,
        limit,
        query,
        sessionKey,
        timeoutMs,
      });

      const notes = Array.isArray(response.notes) ? response.notes : [];
      const summaryText =
        notes.length === 0
          ? `没有找到和“${query}”相关的笔记。`
          : ["找到这些笔记：", ...notes.map(renderKnowledgeSearchItem)].join("\n");

      return {
        content: [{ type: "text", text: summaryText }],
        details: {
          notes,
          query: response.query ?? query,
          total: notes.length,
        },
      };
    },
  };
}

async function requestSearchKnowledge(params: {
  assistantApiBaseUrl: string;
  assistantApiToken: string;
  limit?: number;
  query: string;
  sessionKey: string;
  timeoutMs: number;
}): Promise<SearchKnowledgeResponse> {
  const response = await fetch(
    `${trimTrailingSlash(params.assistantApiBaseUrl)}/api/internal/openclaw/knowledge/search`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.assistantApiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session_key: params.sessionKey,
        query: params.query,
        limit: params.limit,
      }),
      signal: resolveTimeoutSignal(params.timeoutMs),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof payload.details === "string"
        ? payload.details
        : typeof payload.error === "string"
          ? payload.error
          : `assistant api responded ${response.status}`;

    throw new Error(message);
  }

  return payload as SearchKnowledgeResponse;
}

function renderKnowledgeSearchItem(note: KnowledgeNoteSummary, index: number) {
  const title = normalizeText(note.title) ?? `结果 ${index + 1}`;
  const path = normalizeText(note.path);
  const excerpt = normalizeText(note.excerpt);
  const segments = [`${index + 1}. ${title}`];

  if (path) {
    segments.push(`路径：${path}`);
  }

  if (excerpt) {
    segments.push(`摘要：${excerpt}`);
  }

  return segments.join(" · ");
}
