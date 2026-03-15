import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/llm-task";
import {
  normalizeText,
  readPluginConfig,
  resolveTimeoutSignal,
  trimTrailingSlash,
} from "./plugin-config.js";

type CreateKnowledgeNoteResponse = {
  note?: {
    folder_path?: string | null;
    id?: string;
    path?: string;
    title?: string;
  };
};

type CreateKnowledgeNoteToolContext = {
  sessionKey?: string;
};

export function createKnowledgeNoteTool(
  api: OpenClawPluginApi,
  ctx: CreateKnowledgeNoteToolContext,
) {
  return {
    name: "create_knowledge_note",
    label: "Create Knowledge Note",
    description:
      "Create a new markdown note in the user's knowledge vault. Use this only when the user explicitly asks to save, capture, or create a note.",
    parameters: Type.Object({
      title: Type.String({
        description: "The note title.",
        minLength: 1,
        maxLength: 120,
      }),
      content_markdown: Type.Optional(
        Type.String({
          description: "Optional initial markdown content for the note.",
          maxLength: 20_000,
        }),
      ),
      folder_path: Type.Optional(
        Type.String({
          description: "Optional Obsidian-style folder path such as Trips/Japan.",
          minLength: 1,
          maxLength: 200,
        }),
      ),
      tags: Type.Optional(
        Type.Array(
          Type.String({
            minLength: 1,
            maxLength: 40,
          }),
          { maxItems: 16 },
        ),
      ),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const sessionKey = normalizeText(ctx.sessionKey);

      if (!sessionKey) {
        throw new Error("create_knowledge_note requires an active session");
      }

      const title = normalizeText(params.title);

      if (!title) {
        throw new Error("title required");
      }

      const contentMarkdown = normalizeText(params.content_markdown) ?? "";
      const folderPath = normalizeText(params.folder_path);
      const tags = normalizeTags(params.tags);
      const pluginConfig = readPluginConfig(api);

      if (!pluginConfig.assistantApiBaseUrl) {
        throw new Error("personal-assistant-channel missing assistantApiBaseUrl");
      }

      if (!pluginConfig.assistantApiToken) {
        throw new Error("personal-assistant-channel missing assistantApiToken");
      }

      const timeoutMs = pluginConfig.requestTimeoutMs ?? 10_000;
      const response = await requestCreateKnowledgeNote({
        assistantApiBaseUrl: pluginConfig.assistantApiBaseUrl,
        assistantApiToken: pluginConfig.assistantApiToken,
        contentMarkdown,
        folderPath,
        sessionKey,
        tags,
        timeoutMs,
        title,
      });

      const noteTitle = response.note?.title ?? title;
      const notePath = normalizeText(response.note?.path);
      const text = notePath
        ? `已在知识库创建笔记「${noteTitle}」。路径：${notePath}`
        : `已在知识库创建笔记「${noteTitle}」。`;

      return {
        content: [{ type: "text", text }],
        details: {
          note: response.note,
        },
      };
    },
  };
}

async function requestCreateKnowledgeNote(params: {
  assistantApiBaseUrl: string;
  assistantApiToken: string;
  contentMarkdown: string;
  folderPath?: string;
  sessionKey: string;
  tags?: string[];
  timeoutMs: number;
  title: string;
}): Promise<CreateKnowledgeNoteResponse> {
  const response = await fetch(
    `${trimTrailingSlash(params.assistantApiBaseUrl)}/api/internal/openclaw/knowledge/notes`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.assistantApiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session_key: params.sessionKey,
        title: params.title,
        folder_path: params.folderPath,
        content_markdown: params.contentMarkdown,
        properties: params.tags && params.tags.length > 0 ? { tags: params.tags } : undefined,
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

  return payload as CreateKnowledgeNoteResponse;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags = value
    .map((item) => normalizeText(item))
    .filter((item): item is string => typeof item === "string");

  return tags.length > 0 ? tags : undefined;
}
