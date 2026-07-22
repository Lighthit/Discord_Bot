// AI/tools-ai/web-search.js
// เครื่องมือค้นหาเว็บ ต่อเข้ากับ MCP server ฟรี (DuckDuckGo, ไม่ต้องใช้ API key)
// ใช้ pattern เดียวกับ tool อื่น ๆ ในโปรเจกต์ (checkCertificatesTool, getCurrentDateTool, ฯลฯ)

import { tool } from "@openrouter/agent";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// เก็บ connection ไว้ใช้ซ้ำ ไม่ต้องเปิด process ใหม่ทุกครั้งที่มีคนเรียก /chatbot
let mcpClientPromise = null;

function getMcpClient() {
    if (!mcpClientPromise) {
        mcpClientPromise = (async () => {
            const transport = new StdioClientTransport({
                command: "uvx",
                args: ["duckduckgo-mcp-server"],
            });
            const client = new Client(
                { name: "paimon-web-search", version: "1.0.0" },
                { capabilities: {} }
            );
            await client.connect(transport);
            return client;
        })();
    }
    return mcpClientPromise;
}

export const webSearchTool = tool({
    name: "web_search",
    description:
        "ค้นหาข้อมูลบนอินเทอร์เน็ตแบบเรียลไทม์ผ่าน DuckDuckGo ใช้เมื่อผู้ใช้ถามเรื่องที่ต้องการข้อมูลล่าสุด หรือสิ่งที่ AI ไม่รู้จากความรู้เดิม",
    inputSchema: z.object({
        query: z.string().describe("คำค้นหา เป็นภาษาอะไรก็ได้"),
        max_results: z
            .number()
            .int()
            .min(1)
            .max(10)
            .default(5)
            .describe("จำนวนผลลัพธ์ที่ต้องการ (1-10)"),
    }),
    execute: async ({ query, max_results }) => {
        try {
            const client = await getMcpClient();
            // ชื่อ tool จริงของ duckduckgo-mcp-server คือ "search"
            const result = await client.callTool({
                name: "search",
                arguments: { query, max_results },
            });

            // content เป็น array ของ content blocks (มักเป็น type: "text")
            const text = (result.content || [])
                .map((c) => (c.type === "text" ? c.text : ""))
                .filter(Boolean)
                .join("\n");

            return { results: text || "ไม่พบผลลัพธ์การค้นหา" };
        } catch (err) {
            console.error("web_search tool error:", err);
            return { error: `ค้นหาไม่สำเร็จ: ${err.message}` };
        }
    },
});