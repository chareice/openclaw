import { describe, expect, it, vi } from "vitest";
import { searchKnowledgeTool } from "./search-knowledge-tool.js";

describe("search_knowledge tool", () => {
  const sessionKey = "agent:user-1:web:direct:session-1";

  it("returns summarized search results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query: "东京",
        notes: [
          {
            id: "note-1",
            title: "东京清单",
            path: "Trips/东京清单.md",
            excerpt: "先订酒店，再看机票。",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const tool = searchKnowledgeTool(
      {
        pluginConfig: {
          assistantApiBaseUrl: "http://127.0.0.1:4000",
          assistantApiToken: "internal-token",
        },
        registerTool() {},
      } as never,
      { sessionKey },
    );

    const result = await tool.execute("tool-1", { query: "东京", limit: 5 });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.content).toEqual([
      {
        type: "text",
        text: "找到这些笔记：\n1. 东京清单 · 路径：Trips/东京清单.md · 摘要：先订酒店，再看机票。",
      },
    ]);
    expect(result.details).toEqual({
      notes: [
        {
          excerpt: "先订酒店，再看机票。",
          id: "note-1",
          path: "Trips/东京清单.md",
          title: "东京清单",
        },
      ],
      query: "东京",
      total: 1,
    });
  });

  it("requires an active session", async () => {
    const tool = searchKnowledgeTool(
      {
        pluginConfig: {
          assistantApiBaseUrl: "http://127.0.0.1:4000",
          assistantApiToken: "internal-token",
        },
        registerTool() {},
      } as never,
      {},
    );

    await expect(tool.execute("tool-1", { query: "东京" })).rejects.toThrow(
      "search_knowledge requires an active session",
    );
  });
});
