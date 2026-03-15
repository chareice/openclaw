import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/llm-task";
import {
  normalizeText,
  readPluginConfig,
  resolveTimeoutSignal,
  trimTrailingSlash,
} from "./plugin-config.js";

type KnowledgeNotePayload = {
  note?: {
    content_markdown?: string;
    folder_path?: string | null;
    id?: string;
    path?: string;
    properties?: Record<string, unknown>;
    title?: string;
  };
};

type ReadKnowledgeNoteToolContext = {
  sessionKey?: string;
};

export function readKnowledgeNoteTool(api: OpenClawPluginApi, ctx: ReadKnowledgeNoteToolContext) {
  return {
    name: "read_knowledge_note",
    label: "Read Knowledge Note",
    description:
      "Read the full markdown content of a note from the user's knowledge vault. Use this after finding the note id with search_knowledge or when the user explicitly identifies the note.",
    parameters: Type.Object({
      note_id: Type.String({
        description: "The note id returned by search_knowledge or another product response.",
        minLength: 1,
      }),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const sessionKey = normalizeText(ctx.sessionKey);

      if (!sessionKey) {
        throw new Error("read_knowledge_note requires an active session");
      }

      const noteId = normalizeText(params.note_id);

      if (!noteId) {
        throw new Error("note_id required");
      }

      const pluginConfig = readPluginConfig(api);

      if (!pluginConfig.assistantApiBaseUrl) {
        throw new Error("personal-assistant-channel missing assistantApiBaseUrl");
      }

      if (!pluginConfig.assistantApiToken) {
        throw new Error("personal-assistant-channel missing assistantApiToken");
      }

      const timeoutMs = pluginConfig.requestTimeoutMs ?? 10_000;
      const response = await requestReadKnowledgeNote({
        assistantApiBaseUrl: pluginConfig.assistantApiBaseUrl,
        assistantApiToken: pluginConfig.assistantApiToken,
        noteId,
        sessionKey,
        timeoutMs,
      });

      const note = response.note ?? {};
      const title = normalizeText(note.title) ?? "未命名笔记";
      const path = normalizeText(note.path);
      const contentMarkdown = typeof note.content_markdown === "string" ? note.content_markdown : "";
      const header = path ? `# ${title}\n路径：${path}` : `# ${title}`;
      const text = contentMarkdown ? `${header}\n\n${contentMarkdown}` : `${header}\n\n这篇笔记还没有正文。`;

      return {
        content: [{ type: "text", text }],
        details: {
          note,
        },
      };
    },
  };
}

async function requestReadKnowledgeNote(params: {
  assistantApiBaseUrl: string;
  assistantApiToken: string;
  noteId: string;
  sessionKey: string;
  timeoutMs: number;
}): Promise<KnowledgeNotePayload> {
  const response = await fetch(
    `${trimTrailingSlash(params.assistantApiBaseUrl)}/api/internal/openclaw/knowledge/read`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.assistantApiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session_key: params.sessionKey,
        note_id: params.noteId,
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

  return payload as KnowledgeNotePayload;
}
