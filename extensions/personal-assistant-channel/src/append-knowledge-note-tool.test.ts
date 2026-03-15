import { describe, expect, it, vi } from "vitest";
import { appendKnowledgeNoteTool } from "./append-knowledge-note-tool.js";

describe("append_knowledge_note tool", () => {
  const sessionKey = "agent:user-1:web:direct:session-1";

  it("appends content into an existing note", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          note: {
            id: "note-1",
            title: "东京清单",
            path: "Trips/东京清单.md",
          },
        }),
      }),
    );

    const tool = appendKnowledgeNoteTool(
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
      note_id: "note-1",
      content_markdown: "再看机票。",
      edit_reason: "user asked to save it",
    });

    expect(result.content).toEqual([
      {
        type: "text",
        text: "已把内容追加到「东京清单」。路径：Trips/东京清单.md",
      },
    ]);
  });
});
