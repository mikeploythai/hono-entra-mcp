# Hono Entra MCP

Small MCP server for learning how to leverage Microsoft Entra ID as an authorization server, tailored for Claude.

## Develop

You need:

- Node.js LTS

- pnpm

- Text editor, like [Cursor](https://cursor.com/home) or [Visual Studio Code](https://code.visualstudio.com)

- Microsoft Entra

- Cloudflare Workers

- Claude

## Microsoft Entra Setup

Create two app registrations:

| App registration | What it does | Where its secret goes |
| --- | --- | --- |
| `Notes MCP Authorization` | Controls access to the MCP server and checks group membership | Cloudflare Worker |
| `Notes MCP Authentication` | Signs users in through Claude | Claude connector settings |

These steps match the current server code.

### 1. Choose the MCP URL

1. Deploy the Worker or choose the hostname you will use in production.
2. Connect the domain to Cloudflare.
3. If Microsoft Entra does not recognize the domain, verify it under `Microsoft Entra ID > Custom domain names`.
4. Write down the full MCP URL, such as `https://mcp.example.com/mcp`. Use the same URL in every step below. Do not add a trailing slash.

### 2. Create the access groups

Create two security groups under `Microsoft Entra ID > Groups`:

1. One group for people who can connect to the MCP server.
2. One group for people who can use destructive tools.

Write down each group's Object ID. The server uses these IDs instead of the group names.

### 3. Create Notes MCP Authorization

1. Open `Microsoft Entra ID > App registrations > New registration`.
2. Name it `Notes MCP Authorization`.
3. Select `Accounts in this organizational directory only`.
4. Leave `Redirect URI` empty, then create the registration.
5. Write down its `Application (client) ID` and `Directory (tenant) ID`.
6. Add yourself under `Owners`. This makes the registration easier to find under `My APIs` later.

### 4. Add permission to use the MCP server

In `Notes MCP Authorization`:

1. Open `Expose an API`.
2. Set `Application ID URI` to the full MCP URL, such as `https://mcp.example.com/mcp`.
3. Select `Add a scope` and enter:
    - Scope name: `access_as_user`
    - Who can consent: `Admins only`
    - Admin consent display name: `Access the Notes MCP server`
    - Admin consent description: `Allow the application to access the Notes MCP server on behalf of the signed-in user.`
    - State: `Enabled`
4. Write down the full scope, such as `https://mcp.example.com/mcp/access_as_user`.

Microsoft calls this an API scope. See [Configure an application to expose a web API](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis) for more detail.

### 5. Include the user's groups in the access token

Still in `Notes MCP Authorization`:

1. Open `Token configuration > Add groups claim`.
2. Select `Security groups`.
3. Under `Customize token properties by type`, select `Group ID` for access tokens.
4. Save the changes.

Add this setting to `Notes MCP Authorization`, not `Notes MCP Authentication`. It lets the server read the signed-in user's group IDs from the token.

### 6. Allow the server to check groups through Microsoft Graph

Still in `Notes MCP Authorization`:

1. Open `API permissions > Add a permission > Microsoft Graph`.
2. Select `Application permissions`.
3. Add `User.ReadBasic.All`.
4. Add `GroupMember.Read.All`.
5. Select `Grant admin consent for {tenant}` and confirm that both permissions show `Granted`.

The server needs both permissions to check a user's group membership. See the [`checkMemberGroups` permissions](https://learn.microsoft.com/en-us/graph/api/directoryobject-checkmembergroups?view=graph-rest-1.0) for more detail.

### 7. Create the Worker secret

Still in `Notes MCP Authorization`:

1. Open `Certificates & secrets > Client secrets > New client secret`.
2. Name it `Cloudflare Graph access` and choose an expiration that matches the team's rotation policy.
3. Copy the secret **Value** immediately. Do not copy the Secret ID.
4. Save it in Cloudflare as `ENTRA_CLIENT_SECRET`.

This secret belongs only in Cloudflare. Do not put it in `wrangler.jsonc`, source control, or Claude.

### 8. Create Notes MCP Authentication

1. Open `Microsoft Entra ID > App registrations > New registration`.
2. Name it `Notes MCP Authentication`.
3. Select `Accounts in this organizational directory only`.
4. Under `Redirect URI`, select `Web` and enter `https://claude.ai/api/mcp/auth_callback`.
5. Create the registration and write down its `Application (client) ID`.
6. Add yourself under `Owners`.

### 9. Connect Authentication to Authorization

In `Notes MCP Authentication`:

1. Open `API permissions > Add a permission > My APIs`.
2. Select `Notes MCP Authorization`.
3. Select `Delegated permissions`.
4. Select `access_as_user`, then add the permission.
5. Select `Grant admin consent for {tenant}` and confirm that the permission shows `Granted`.

This lets `Notes MCP Authentication` request access to `Notes MCP Authorization`. See [Configure app permissions for a web API](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis) for more detail.

To avoid another consent prompt, open `Notes MCP Authorization > Expose an API > Authorized client applications`. Add the Application ID from `Notes MCP Authentication` and select `access_as_user`. This does not block other approved clients.

### 10. Create the Claude secret

In `Notes MCP Authentication`:

1. Open `Certificates & secrets > Client secrets > New client secret`.
2. Name it `Claude connector` and choose an expiration that matches the team's rotation policy.
3. Copy the secret **Value** immediately.

This is not the same secret as `ENTRA_CLIENT_SECRET`. Store it only in Claude.

### 11. Configure the Worker

Set the following values in `wrangler.jsonc` or the Cloudflare dashboard:

| Setting | Value |
| --- | --- |
| `MCP_SERVER_URL` | Full MCP URL, such as `https://mcp.example.com/mcp` |
| `ENTRA_TENANT_ID` | Directory ID used by both registrations |
| `ENTRA_CLIENT_ID` | Application ID from `Notes MCP Authorization` |
| `ENTRA_ALLOWED_GROUP_ID` | Object ID of the group allowed to connect |
| `ENTRA_DESTRUCTIVE_GROUP_ID` | Object ID of the group allowed to use destructive tools |

Set `ENTRA_CLIENT_SECRET` as a Worker secret rather than a plain configuration variable:

```sh
pnpm wrangler secret put ENTRA_CLIENT_SECRET
```

Paste the secret when Wrangler prompts you, then deploy with `pnpm run deploy`. See [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/) for dashboard and CI options.

### 12. Configure Claude

Create or edit the custom connector in Claude:

1. MCP server URL: the value of `MCP_SERVER_URL`.
2. OAuth Client ID: the Application ID from `Notes MCP Authentication`.
3. OAuth Client Secret: the secret Value from `Notes MCP Authentication`.
4. Connect the server and sign in with Microsoft Entra.

***

I hate Azure btw
