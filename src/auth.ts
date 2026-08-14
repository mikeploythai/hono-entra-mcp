import {
	type AuthMetadataOptions,
	getOAuthProtectedResourceMetadataUrl,
	OAuthError,
	OAuthErrorCode,
	oauthMetadataResponse,
	requireBearerAuth,
} from "@modelcontextprotocol/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import z from "zod";

const accessTokenSchema = z.object({
	sub: z.string().min(1),
	tid: z.string().min(1),
	appid: z.string().optional(),
	oid: z.string().optional(),
	scp: z.string().default(""),
	roles: z.array(z.string()).default([]),
	exp: z.number().int().positive(),
	ver: z.literal("1.0"),
	groups: z.array(z.string()).default([]),
});

export const createAuth = (env: CloudflareBindings) => {
	const resourceUrl = new URL(env.MCP_SERVER_URL);
	const authority = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}`;
	const issuer = `https://sts.windows.net/${env.ENTRA_TENANT_ID}/`;
	const scope = `${resourceUrl.href}/access_as_user`;
	const jwks = createRemoteJWKSet(new URL(`${authority}/discovery/keys`));

	const authenticate = requireBearerAuth({
		requiredScopes: [scope],
		resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
		verifier: {
			async verifyAccessToken(token) {
				try {
					const result = await jwtVerify(token, jwks, {
						issuer,
						audience: resourceUrl.href,
						algorithms: ["RS256"],
					});

					const claims = accessTokenSchema.parse(result.payload);
					if (claims.tid !== env.ENTRA_TENANT_ID) throw new Error();
					if (!claims.groups.includes(env.ENTRA_ALLOWED_GROUP_ID)) {
						throw new OAuthError(
							OAuthErrorCode.InsufficientScope,
							"User is not authorized to access this MCP server",
						);
					}

					const scopes = claims.scp.split(" ").filter(Boolean);

					return {
						token,
						clientId: claims.appid ?? claims.sub,
						scopes: [
							...scopes,
							...scopes.map((value) => `${resourceUrl.href}/${value}`),
						],
						expiresAt: claims.exp,
						extra: {
							subject: claims.sub,
							objectId: claims.oid,
							tenantId: claims.tid,
							roles: claims.roles,
							groups: claims.groups,
						},
					};
				} catch (error) {
					if (error instanceof OAuthError) throw error;
					throw new OAuthError(
						OAuthErrorCode.InvalidToken,
						"Invalid or expired Entra access token",
					);
				}
			},
		},
	});

	const metadataOptions = {
		resourceServerUrl: resourceUrl,
		resourceName: "Notes MCP",
		scopesSupported: [scope],
		oauthMetadata: {
			issuer: `${authority}/v2.0`,
			authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
			token_endpoint: `${authority}/oauth2/v2.0/token`,
			jwks_uri: `${authority}/discovery/v2.0/keys`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			token_endpoint_auth_methods_supported: [
				"client_secret_basic",
				"client_secret_post",
				"none",
			],
			code_challenge_methods_supported: ["S256"],
			scopes_supported: [scope, "offline_access"],
		},
	} satisfies AuthMetadataOptions;

	return {
		authenticate,
		metadata: (request: Request) =>
			oauthMetadataResponse(request, metadataOptions),
	};
};
