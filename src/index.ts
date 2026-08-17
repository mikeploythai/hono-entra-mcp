import { env } from "cloudflare:workers";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { Context } from "hono";
import z from "zod";
import { createAuth } from "./auth";
import { createGroupAuthorizer } from "./graph";

const auth = createAuth(env);
const isGroupMember = createGroupAuthorizer(env);

const handler = createMcpHandler(async ({ authInfo }) => {
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

	const userId = z.string().min(1).safeParse(authInfo?.extra?.objectId);

	const isDestructiveGroupMember = async () => {
		if (!userId.success) return false;

		try {
			return await isGroupMember(userId.data, env.ENTRA_DESTRUCTIVE_GROUP_ID);
		} catch {
			return false;
		}
	};

	const canDelete = await isDestructiveGroupMember();

	server.registerTool(
		"delete-note",
		{
			description: "Delete a note",
			inputSchema: z.object({ id: z.string() }),
		},
		async ({ id }) => {
			if (!canDelete) {
				return {
					content: [
						{
							type: "text",
							text: "You do not currently have permission to delete notes.",
						},
					],
					isError: true,
				};
			}

			return { content: [{ type: "text", text: `Deleted: ${id}` }] };
		},
	);

	return server;
});

const app = createMcpHonoApp({
	host: "0.0.0.0",
	allowedHosts: env.MCP_ALLOWED_HOSTS,
	allowedOrigins: env.MCP_ALLOWED_HOSTS,
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.use("*", async (c, next) => {
	const response = auth.metadata(c.req.raw);
	if (response) return response;
	await next();
});

app.all("/mcp", async (c: Context) => {
	const authInfo = await auth.authenticate(c.req.raw);
	if (authInfo instanceof Response) return authInfo;

	return handler.fetch(c.req.raw, {
		parsedBody: c.get("parsedBody"),
		authInfo,
	});
});

export default app;
