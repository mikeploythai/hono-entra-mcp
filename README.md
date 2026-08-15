# Hono Entra MCP

Small MCP server for learning how to leverage Microsoft Entra ID as an authorization server, tailored for Claude.

## Develop

You need:

- Node.js LTS

- [pnpm](https://pnpm.io/installation#using-npm)

- Text editor, like [Cursor](https://cursor.com/home) or [Visual Studio Code](https://code.visualstudio.com)

- Azure account for Entra ID authentication

- Cloudflare for hosting this server as a [worker](https://cloudflare.com/en-in/developer-platform/products/workers)

## Azure Setup

Temporarily just one app registration; updating to 2 later.

1. Create a new app registration
    - Copy the application (client) ID and tenant ID; it'll be super important later

2. Add Claude's callback URL under `Authentication (Preview) > Redirect URI configuration`
    - Platform Type: Web
    - Redirect URI: `https://claude.ai/api/mcp/auth_callback`

3. Create a client secret for Claude

### Authorization

This MCP has group-based authorization for the server as a whole and for individual tools

1. Add a groups claim under `Token configuration`
    - Select the `Security groups` group type
    - Select `Group ID` under `Customize token properties by type`

2. Add 2 API permissions; this is used for the Microsoft Graph integration
    - Add a permission > APIs my organization uses > Microsoft Graph > Application permissions > User.ReadBasic.All AND GroupMember.Read.All

3. Set the Application ID URI to `https://{your_domain}/mcp` and add a new scope; I guess you can name the scope anything but this was my config
    - Scope name: access_as_user
    - Who can consent?: Admins only
    - Admin consent display name: Access the Notes MCP server
    - Admin consent description: I actually don't remember what I wrote here lol Azure won't show it
    - State: Enabled

4. Make 2 security groups: 1 for access to use the MCP in general and another for allowing certain tools to certain people
    - Use the object IDs from them to check in code if a user is in a group

5. Create a separate client secret for the Microsoft Graph integration in the API

***

Heavy WIP. I hate Azure btw.