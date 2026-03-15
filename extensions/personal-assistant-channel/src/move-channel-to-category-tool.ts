import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/llm-task";
import {
  normalizeText,
  readPluginConfig,
  resolveTimeoutSignal,
  trimTrailingSlash,
} from "./plugin-config.js";

type OrganizeChannelResponse = {
  channel?: {
    category?: {
      id?: string;
      kind?: string;
      name?: string;
      slug?: string;
    };
    id?: string;
    kind?: string;
    name?: string;
    primary_thread_id?: string;
  };
  mode?: "current" | "updated";
  moved?: boolean;
};

type MoveChannelToCategoryToolContext = {
  sessionKey?: string;
};

export function moveChannelToCategoryTool(
  api: OpenClawPluginApi,
  ctx: MoveChannelToCategoryToolContext,
) {
  return {
    name: "move_channel_to_category",
    label: "Move Channel To Category",
    description:
      "Move an existing topic channel into a category for the current user. Creates the category if needed. Only use this when the user explicitly asks to organize, group, sort, or move a topic.",
    parameters: Type.Object({
      category_name: Type.String({
        description: "The destination category name.",
        minLength: 1,
        maxLength: 40,
      }),
      channel_name: Type.Optional(
        Type.String({
          description:
            "Optional channel name. Omit to move the current channel you are chatting in.",
          minLength: 1,
          maxLength: 40,
        }),
      ),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const sessionKey = normalizeText(ctx.sessionKey);

      if (!sessionKey) {
        throw new Error("move_channel_to_category requires an active session");
      }

      const categoryName = normalizeText(params.category_name);

      if (!categoryName) {
        throw new Error("category_name required");
      }

      const channelName = normalizeText(params.channel_name);
      const pluginConfig = readPluginConfig(api);

      if (!pluginConfig.assistantApiBaseUrl) {
        throw new Error("personal-assistant-channel missing assistantApiBaseUrl");
      }

      if (!pluginConfig.assistantApiToken) {
        throw new Error("personal-assistant-channel missing assistantApiToken");
      }

      const timeoutMs = pluginConfig.requestTimeoutMs ?? 10_000;
      const response = await requestMoveChannelToCategory({
        assistantApiBaseUrl: pluginConfig.assistantApiBaseUrl,
        assistantApiToken: pluginConfig.assistantApiToken,
        categoryName,
        channelName,
        sessionKey,
        timeoutMs,
      });

      const resolvedChannelName = response.channel?.name ?? channelName ?? "当前主题";
      const resolvedCategoryName = response.channel?.category?.name ?? categoryName;
      const text = response.moved
        ? `已把「${resolvedChannelName}」整理到「${resolvedCategoryName}」分类。`
        : `「${resolvedChannelName}」已经在「${resolvedCategoryName}」分类里了。`;

      return {
        content: [{ type: "text", text }],
        details: {
          category: response.channel?.category,
          channel: response.channel,
          mode: response.mode ?? (response.moved ? "updated" : "current"),
          moved: response.moved ?? false,
        },
      };
    },
  };
}

async function requestMoveChannelToCategory(params: {
  assistantApiBaseUrl: string;
  assistantApiToken: string;
  categoryName: string;
  channelName?: string;
  sessionKey: string;
  timeoutMs: number;
}): Promise<OrganizeChannelResponse> {
  const response = await fetch(
    `${trimTrailingSlash(params.assistantApiBaseUrl)}/api/internal/openclaw/channels/organize`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.assistantApiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session_key: params.sessionKey,
        channel_name: params.channelName,
        category_name: params.categoryName,
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

  return payload as OrganizeChannelResponse;
}
