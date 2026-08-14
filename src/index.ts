import { env } from "cloudflare:workers";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { Context } from "hono";
import z from "zod";

const handler = createMcpHandler(() => {
	const server = new McpServer({ name: "notes", version: "1.0.0" });

	server.registerTool(
		"add-note",
		{
			description: "Append a note",
			inputSchema: z.object({ text: z.string() }),
		},
		async ({ text }) => ({
			content: [{ type: "text", text: `Saved: ${text}` }],
		}),
	);

	return server;
});

const app = createMcpHonoApp({
	host: "0.0.0.0",
	allowedHosts: env.MCP_ALLOWED_HOSTS,
	allowedOrigins: env.MCP_ALLOWED_HOSTS,
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.all("/mcp", (c: Context) =>
	handler.fetch(c.req.raw, { parsedBody: c.get("parsedBody") }),
);

export default app;
