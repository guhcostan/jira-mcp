# Jira MCP Server v2.5.0

A complete MCP (Model Context Protocol) server for Jira integration, allowing AI assistants to interact with your Jira instance.

## 🚀 Installation

### Via npx (Recommended)

```bash
npx @guhcostan/jira-mcp
```

### Via npm global

```bash
npm install -g @guhcostan/jira-mcp
jira-mcp
```

### Local Development

```bash
git clone https://github.com/guhcostan/jira-mcp.git
cd jira-mcp
npm install
npm run build
```

## 🔧 Configuration

### 1. Set up environment variables

Create a `.env` file in the project root:

```env
JIRA_URL=https://your-jira-instance.com
JIRA_ACCESS_TOKEN=your-jira-access-token
```

**Note**: This server uses Jira **Access Token** with Bearer authentication (Jira Data Center/Server). For Jira Cloud, you may need to use Basic Auth.

### 2. Configure in Claude Desktop or Cursor

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@guhcostan/jira-mcp"],
      "env": {
        "JIRA_URL": "https://your-jira-instance.com",
        "JIRA_ACCESS_TOKEN": "your-jira-access-token"
      }
    }
  }
}
```

**For local development**, use:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["/path/to/your/jira-mcp/build/index.js"],
      "env": {
        "JIRA_URL": "https://your-jira-instance.com",
        "JIRA_ACCESS_TOKEN": "your-jira-access-token"
      }
    }
  }
}
```

### 3. Restart Claude Desktop / Cursor

Close and reopen the application completely to load the MCP server.

## 📚 Features

This MCP server provides **36 tools** to interact with Jira:

### 📖 Read Operations (21 tools)

#### Issues
- `jira_get_issue` - Get issue details
- `jira_search` - Search issues with JQL
- `jira_get_project_issues` - Get project issues
- `jira_batch_get_changelogs` - Batch get changelogs
- `jira_download_attachments` - Get attachment info

#### Projects
- `jira_get_all_projects` - List all projects
- `jira_get_project` - Get project details
- `jira_get_project_versions` - Get project versions
- `jira_search_projects` - Search projects by pattern

#### Metrics & Analytics
- `jira_get_issue_types` - List all issue types
- `jira_get_metrics_summary` - Get consolidated metrics summary
- `jira_get_metrics_by_project` - Get detailed metrics by project

#### Other
- `jira_get_worklog` - Get issue worklogs
- `jira_get_transitions` - Get available transitions
- `jira_search_fields` - Search Jira fields
- `jira_get_agile_boards` - List agile boards
- `jira_get_board_issues` - Get board issues
- `jira_get_sprints_from_board` - Get board sprints
- `jira_get_sprint_issues` - Get sprint issues
- `jira_get_issue_link_types` - Get link types
- `jira_get_user_profile` - Get user information

### ✏️ Write Operations (15 tools)

#### Issues
- `jira_create_issue` - Create issue
- `jira_batch_create_issues` - Create multiple issues
- `jira_update_issue` - Update issue
- `jira_delete_issue` - Delete issue
- `jira_assign_issue` - Assign issue

#### Other
- `jira_add_comment` - Add comment
- `jira_transition_issue` - Change status
- `jira_add_worklog` - Add worklog
- `jira_link_to_epic` - Link to epic
- `jira_create_sprint` - Create sprint
- `jira_update_sprint` - Update sprint
- `jira_create_issue_link` - Create issue link
- `jira_remove_issue_link` - Remove link
- `jira_create_version` - Create version
- `jira_batch_create_versions` - Create multiple versions

## 💡 Usage Examples

### Search Issues

```javascript
// In Claude/Cursor, just ask:
"Find the last 10 open issues in project ABC"
"What are the critical bugs in the current sprint?"
```

### Create Issue

```javascript
"Create a Task issue in project XYZ with title 'Implement authentication'"
```

### Manage Sprint

```javascript
"List all active sprints from board 123"
"Move issue ABC-456 to sprint 789"
```

### Advanced JQL

```javascript
"Search issues with JQL: project = DEV AND status = 'In Progress' AND assignee = currentUser()"
```

### Generate Metrics Reports (New in v2.5.0!)

```javascript
// Search projects
"Find all projects that contain 'mobile' in the name"

// Get metrics summary
"Give me a summary of Tasks, Bugs, and Tech Debts for projects PROJ1, PROJ2, and PROJ3 created since 2024-10-01"

// Get detailed metrics by project
"Show me detailed metrics for each eLoyalty project, including Tasks, Bugs, and Tech Debts"
```

## 🔍 Tool Reference

### jira_get_issue
Get details of a specific issue.

**Parameters:**
- `issueKey` (required): Issue key (e.g., PROJ-123)
- `fields` (optional): Fields to return (e.g., "summary,status,assignee")
- `expand` (optional): Expand fields (e.g., "changelog,renderedFields")

### jira_search
Search issues using JQL.

**Parameters:**
- `jql` (required): JQL query (e.g., "project = PROJ AND status = Open")
- `maxResults` (optional): Maximum number of results (default: 50)
- `startAt` (optional): Starting index for pagination (default: 0)
- `fields` (optional): Fields to return

### jira_create_issue
Create a new issue.

**Parameters:**
- `project` (required): Project key
- `summary` (required): Issue title
- `issueType` (required): Type (Task, Bug, Story, etc)
- `description` (optional): Description
- `priority` (optional): Priority (High, Medium, Low)
- `assignee` (optional): Assignee account ID
- `labels` (optional): Array of labels
- `parentKey` (optional): Parent issue key (for subtasks)

### jira_transition_issue
Transition an issue to another status.

**Parameters:**
- `issueKey` (required): Issue key
- `transition` (required): Transition name or ID

### jira_create_sprint
Create a new sprint.

**Parameters:**
- `boardId` (required): Board ID
- `name` (required): Sprint name
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `goal` (optional): Sprint goal

### jira_get_metrics_summary (New in v2.5.0)
Get consolidated metrics summary across multiple projects.

**Parameters:**
- `projectKeys` (required): Array of project keys (e.g., ["PROJ1", "PROJ2"])
- `issueTypes` (required): Array of issue type names (e.g., ["Task", "Bug"])
- `createdSince` (optional): Filter by creation date (YYYY-MM-DD format)

**Example:**
```javascript
"Get metrics summary for projects ABC, DEF, and GHI showing Tasks and Bugs created since 2024-01-01"
```

### jira_get_metrics_by_project (New in v2.5.0)
Get detailed metrics breakdown by individual project.

**Parameters:**
- `projectKeys` (required): Array of project keys
- `issueTypes` (required): Array of issue type names
- `createdSince` (optional): Filter by creation date (YYYY-MM-DD format)

**Example:**
```javascript
"Show me detailed metrics for each project in the eLoyalty team"
```

## 🔐 Authentication

### Jira Data Center/Server (Access Token)

This server uses Jira Access Token with Bearer authentication by default, ideal for Jira Data Center/Server instances:

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Jira Cloud (Basic Auth)

If you use Jira Cloud, you may need to modify the authentication to Basic Auth in the code.

### How to get a Jira Access Token

**Step-by-step guide:**

1. **Open your Jira instance** (e.g., `https://your-jira-instance.com`)
2. **Click on your profile picture** (top-right corner)
3. **Select "Profile"** from the dropdown menu
4. **Navigate to "Personal Access Tokens"** tab
   - Or go directly to: `https://your-jira-instance.com/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens`
5. **Click "Create token"**
6. **Fill in the token details:**
   - Name: Give it a meaningful name (e.g., "MCP Server")
   - Expiration: Choose an expiration date or "Never expire" (if available)
7. **Copy the token** immediately (you won't be able to see it again!)
8. **Add the token** to your `.env` file as `JIRA_ACCESS_TOKEN`

**Important Notes:**
- Store the token securely
- Don't commit the token to version control
- If you lose the token, you'll need to generate a new one
- The token inherits your user permissions

## 🛠️ Development

### Project Structure

```
jira-mcp/
├── src/
│   └── index.ts          # Main MCP server
├── build/                # Compiled files
├── package.json
├── tsconfig.json
├── .env                  # Credentials (don't commit!)
├── .gitignore
└── README.md
```

### Available Scripts

```bash
npm run build          # Compile TypeScript
npm run watch          # Compile in watch mode
npm run prepare        # Runs automatically on npm install
```

### Test Locally

```bash
# Compile
npm run build

# Run directly
node build/index.js
```

## 📝 Important Notes

- ✅ Supports Jira Data Center/Server with Access Token
- ✅ 36 complete tools (21 read + 15 write)
- ✅ JQL support for advanced searches
- ✅ Batch operations for better performance
- ✅ **Metrics & Analytics tools** for generating reports (v2.5.0)
- ✅ **Connection validation** on startup - tools only appear if Jira is accessible
- ✅ **Improved error handling** with helpful error messages and suggestions
- ⚠️ Requires appropriate Jira permissions for each operation
- ⚠️ Rate limiting is applied by Jira

## 🐛 Troubleshooting

### No tools appearing in Claude/Cursor

**The server validates the connection on startup. If no tools appear, check the logs:**

1. **Connection validation failed** - The server couldn't connect to Jira
   - Check your `JIRA_URL` is correct
   - Verify your `JIRA_ACCESS_TOKEN` is valid
   - Ensure Jira is accessible from your network

2. **Look at the server logs** for specific error messages:
   - In Claude Desktop: Check the application logs
   - The server will show: `✅ Connected to Jira as: [Your Name]` or `❌ Jira connection failed: [error]`

### Error 401 - Unauthorized

- Check if the access token is correct
- Confirm you're using Bearer authentication with access token (not Basic Auth)
- **Verify the token hasn't expired** - tokens can expire, generate a new one if needed
- Ensure the token has the necessary permissions

### Error 403 - Forbidden

- Your token doesn't have permission for this operation
- Check your Jira user permissions
- Some operations require admin privileges

### Error 404 - Not Found

- The issue/project/resource doesn't exist
- Check the issue key or project key is correct
- Verify you have access to view the resource

### Connection timeout or network errors

- Check your network connection
- Verify Jira server is accessible
- Check if there's a firewall blocking the connection

### Server doesn't appear in Claude/Cursor at all

1. Check if the path in config is correct
2. Restart the application completely
3. Check Claude/Cursor logs for startup errors
4. Verify Node.js is installed and accessible

## 📄 License

MIT

## 👤 Author

Gustavo Neves

## 🔗 Links

- GitHub: https://github.com/guhcostan/jira-mcp
- npm: https://www.npmjs.com/package/@guhcostan/jira-mcp
- Issues: https://github.com/guhcostan/jira-mcp/issues

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or pull requests.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
