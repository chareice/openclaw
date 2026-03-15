import { describe, expect, it, vi } from "vitest";
import { readKnowledgeNoteTool } from "./read-knowledge-note-tool.js";

describe("read_knowledge_note tool", () => {
  const sessionKey = "agent:user-1:web:direct:session-1";

  it("returns note markdown content", async () => {
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
            content_markdown: "- 先订酒店\n- 再看机票",
          },
        }),
      }),
    );

    const tool = readKnowledgeNoteTool(
      {
        pluginConfig: {
          assistantApiBaseUrl: "http://127.0.0.1:4000",
          assistantApiToken: "internal-token",
        },
        registerTool() {},
      } as never,
      { sessionKey },
    );

    const result = await tool.execute("tool-1", { note_id: "note-1" });

    expect(result.content).toEqual([
      {
        type: "text",
        text: "# 东京清单\n路径：Trips/东京清单.md\n\n- 先订酒店\n- 再看机票",
      },
    ]);
  });
});
