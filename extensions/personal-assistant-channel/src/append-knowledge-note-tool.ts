import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/llm-task";
import {
  normalizeText,
  readPluginConfig,
  resolveTimeoutSignal,
  trimTrailingSlash,
} from "./plugin-config.js";

type AppendKnowledgeNoteResponse = {
  note?: {
    id?: string;
    path?: string;
    title?: string;
  };
};

type AppendKnowledgeNoteToolContext = {
  sessionKey?: string;
};

export function appendKnowledgeNoteTool(
  api: OpenClawPluginApi,
  ctx: AppendKnowledgeNoteToolContext,
) {
  return {
    name: "append_knowledge_note",
    label: "Append Knowledge Note",
    description:
      "Append markdown content to an existing note in the user's knowledge vault. Use this only when the user explicitly asks to add or save more content into an existing note.",
    parameters: Type.Object({
      note_id: Type.String({
        description: "The note id to append to.",
        minLength: 1,
      }),
      content_markdown: Type.String({
        description: "Markdown content to append to the end of the note.",
        minLength: 1,
        maxLength: 20_000,
      }),
      edit_reason: Type.Optional(
        Type.String({
          description: "Optional short reason for the append operation.",
          maxLength: 120,
        }),
      ),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const sessionKey = normalizeText(ctx.sessionKey);

      if (!sessionKey) {
        throw new Error("append_knowledge_note requires an active session");
      }

      const noteId = normalizeText(params.note_id);
      const contentMarkdown = normalizeText(params.content_markdown);

      if (!noteId) {
        throw new Error("note_id required");
      }

      if (!contentMarkdown) {
        throw new Error("content_markdown required");
      }

      const editReason = normalizeText(params.edit_reason);
      const pluginConfig = readPluginConfig(api);

      if (!pluginConfig.assistantApiBaseUrl) {
        throw new Error("personal-assistant-channel missing assistantApiBaseUrl");
      }

      if (!pluginConfig.assistantApiToken) {
        throw new Error("personal-assistant-channel missing assistantApiToken");
      }

      const timeoutMs = pluginConfig.requestTimeoutMs ?? 10_000;
      const response = await requestAppendKnowledgeNote({
        assistantApiBaseUrl: pluginConfig.assistantApiBaseUrl,
        assistantApiToken: pluginConfig.assistantApiToken,
        contentMarkdown,
        editReason,
        noteId,
        sessionKey,
        timeoutMs,
      });

      const noteTitle = response.note?.title ?? "这篇笔记";
      const notePath = normalizeText(response.note?.path);
      const text = notePath
        ? `已把内容追加到「${noteTitle}」。路径：${notePath}`
        : `已把内容追加到「${noteTitle}」。`;

      return {
        content: [{ type: "text", text }],
        details: {
          note: response.note,
        },
      };
    },
  };
}

async function requestAppendKnowledgeNote(params: {
  assistantApiBaseUrl: string;
  assistantApiToken: string;
  contentMarkdown: string;
  editReason?: string;
  noteId: string;
  sessionKey: string;
  timeoutMs: number;
}): Promise<AppendKnowledgeNoteResponse> {
  const response = await fetch(
    `${trimTrailingSlash(params.assistantApiBaseUrl)}/api/internal/openclaw/knowledge/notes/${encodeURIComponent(params.noteId)}/append`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.assistantApiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session_key: params.sessionKey,
        content_markdown: params.contentMarkdown,
        edit_reason: params.editReason,
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

  return payload as AppendKnowledgeNoteResponse;
}
