import { describe, expect, it, vi } from "vitest";
import { createKnowledgeNoteTool } from "./create-knowledge-note-tool.js";

describe("create_knowledge_note tool", () => {
  const sessionKey = "agent:user-1:web:direct:session-1";

  it("creates a new note and returns the created path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        note: {
          id: "note-1",
          title: "东京清单",
          path: "Trips/东京清单.md",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const tool = createKnowledgeNoteTool(
      {
        pluginConfig: {
          assistantApiBaseUrl: "http://127.0.0.1:4000",
          assistantApiToken: "internal-token",
        },
        registerTool() {},
      } as never,
      { sessionKey },
    );

    const result = await tool.execute("tool-1", {
      title: "东京清单",
      folder_path: "Trips",
      content_markdown: "先订酒店。",
      tags: ["travel", "japan"],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.content).toEqual([
      {
        type: "text",
        text: "已在知识库创建笔记「东京清单」。路径：Trips/东京清单.md",
      },
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"tags":["travel","japan"]');
  });
});
