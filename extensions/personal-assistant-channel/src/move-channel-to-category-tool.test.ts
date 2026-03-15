import { beforeEach, describe, expect, it, vi } from "vitest";
import { moveChannelToCategoryTool } from "./move-channel-to-category-tool.js";

function fakeApi(overrides: Record<string, unknown> = {}) {
  return {
    id: "personal-assistant-channel",
    name: "personal-assistant-channel",
    source: "test",
    config: {},
    pluginConfig: {
      assistantApiBaseUrl: "http://127.0.0.1:4000",
      assistantApiToken: "test-token",
      ...overrides.pluginConfig,
    },
    runtime: { version: "test" },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    registerTool() {},
    ...overrides,
  };
}

describe("move_channel_to_category tool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("moves a channel into a category through the assistant api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        moved: true,
        mode: "updated",
        channel: {
          id: "channel-1",
          name: "旅行",
          category: { id: "category-1", name: "出行" },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const tool = moveChannelToCategoryTool(fakeApi(), { sessionKey: "agent:test:session-1" });
    const result = await tool.execute("tool-1", {
      channel_name: "旅行",
      category_name: "出行",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/api/internal/openclaw/channels/organize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-token",
          "content-type": "application/json",
        }),
      }),
    );
    expect(result.content[0]?.text).toContain("出行");
    expect(result.details).toMatchObject({
      moved: true,
      mode: "updated",
      channel: { id: "channel-1", name: "旅行" },
      category: { id: "category-1", name: "出行" },
    });
  });

  it("requires an active session key", async () => {
    const tool = moveChannelToCategoryTool(fakeApi(), {});
    await expect(
      tool.execute("tool-1", { channel_name: "旅行", category_name: "出行" }),
    ).rejects.toThrow(/active session/i);
  });

  it("documents that organization must be user-explicit", () => {
    const tool = moveChannelToCategoryTool(fakeApi(), {
      sessionKey: "agent:test:session-1",
    });

    expect(tool.description).toMatch(/explicitly asks/i);
  });
});
