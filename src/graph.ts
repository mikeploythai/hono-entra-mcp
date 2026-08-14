import z from "zod";

const configSchema = z.object({
	ENTRA_TENANT_ID: z.string().min(1),
	ENTRA_CLIENT_ID: z.string().min(1),
	ENTRA_CLIENT_SECRET: z.string().min(1),
});

const tokenSchema = z.object({ access_token: z.string().min(1) });
const membershipsSchema = z.object({ value: z.array(z.string()) });

export const createGroupAuthorizer = (env: CloudflareBindings) => {
	const config = configSchema.parse(env);

	return async (userId: string, groupId: string) => {
		const tokenResponse = await fetch(
			`https://login.microsoftonline.com/${config.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: config.ENTRA_CLIENT_ID,
					client_secret: config.ENTRA_CLIENT_SECRET,
					grant_type: "client_credentials",
					scope: "https://graph.microsoft.com/.default",
				}),
			},
		);
		if (!tokenResponse.ok) throw new Error("Unable to authenticate to Graph");

		const token = tokenSchema.parse(await tokenResponse.json());

		const membershipResponse = await fetch(
			`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/checkMemberGroups`,
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${token.access_token}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ groupIds: [groupId] }),
			},
		);
		if (!membershipResponse.ok)
			throw new Error("Unable to verify group membership");

		const memberships = membershipsSchema.parse(
			await membershipResponse.json(),
		);

		return memberships.value.includes(groupId);
	};
};
