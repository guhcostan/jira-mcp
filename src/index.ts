#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import axios from 'axios';
import https from 'https';

// Load environment variables
dotenv.config();

const JIRA_URL = process.env.JIRA_URL;
const JIRA_ACCESS_TOKEN = process.env.JIRA_ACCESS_TOKEN;

if (!JIRA_URL || !JIRA_ACCESS_TOKEN) {
  console.error('Error: Missing required environment variables');
  console.error('Please set: JIRA_URL, JIRA_ACCESS_TOKEN');
  console.error('JIRA_ACCESS_TOKEN should be your Jira Personal Access Token');
  process.exit(1);
}

// Create authorization header (Bearer authentication with Jira Access Token)
const authHeader = `Bearer ${JIRA_ACCESS_TOKEN}`;

interface JiraApiResponse {
  [key: string]: any;
}

async function callJiraApi(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<JiraApiResponse> {
  const url = `${JIRA_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios({
      url,
      method,
      headers,
      data: body,
      timeout: 30000,
      maxRedirects: 0, // Don't follow redirects
      validateStatus: (status) => status >= 200 && status < 400, // Accept 2xx and 3xx
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Allow self-signed certificates
      }),
    });
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      let errorMessage = `HTTP ${error.response.status}: ${error.response.statusText || 'Error'}`;
      
      if (error.response.data) {
        const errorData = typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200)
          : JSON.stringify(error.response.data).substring(0, 200);
        errorMessage += ` - ${errorData}`;
      }
      
      throw new Error(errorMessage);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error(`Cannot connect to Jira at ${JIRA_URL}. Please check your JIRA_URL.`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Request to Jira timed out. The server might be slow or unreachable.`);
    } else {
      throw new Error(error.message || 'Unknown error occurred while calling Jira API');
    }
  }
}

/**
 * Validate Jira connection and credentials
 */
async function validateJiraConnection(): Promise<{ valid: boolean; error?: string; user?: string }> {
  try {
    console.error('🔍 Validating Jira connection...');
    
    // Test connection by getting current user info
    const user = await callJiraApi('/rest/api/2/myself');
    
    console.error(`✅ Connected to Jira as: ${user.displayName || user.name}`);
    return { 
      valid: true, 
      user: user.displayName || user.name 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Jira connection failed: ${errorMessage}`);
    
    let friendlyError = 'Failed to connect to Jira. ';
    
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      friendlyError += 'Authentication failed. Please check your JIRA_ACCESS_TOKEN is valid and has not expired.';
    } else if (errorMessage.includes('Cannot connect')) {
      friendlyError += 'Cannot reach Jira server. Please check your JIRA_URL is correct.';
    } else if (errorMessage.includes('timeout')) {
      friendlyError += 'Connection timed out. The server might be slow or unreachable.';
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      friendlyError += 'Access denied. Your token does not have sufficient permissions.';
    } else {
      friendlyError += errorMessage;
    }
    
    return { valid: false, error: friendlyError };
  }
}

const server = new Server(
  {
    name: 'jira-mcp-server',
    version: '2.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Connection validation state
let connectionValidated = false;
let connectionError: string | undefined;

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Validate connection on first request
  if (!connectionValidated) {
    const validation = await validateJiraConnection();
    connectionValidated = true;
    
    if (!validation.valid) {
      connectionError = validation.error;
      // Return empty tools list if connection fails
      return {
        tools: [],
      };
    }
  }
  
  // If there was a connection error, return empty list
  if (connectionError) {
    return {
      tools: [],
    };
  }
  
  return {
    tools: [
      // ===== READ OPERATIONS =====
      {
        name: 'jira_get_issue',
        description: 'Get details of a specific Jira issue by key',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key (e.g., PROJ-123)',
            },
            fields: {
              type: 'string',
              description: 'Comma-separated list of fields to return (optional)',
            },
            expand: {
              type: 'string',
              description: 'Comma-separated list of fields to expand (optional, e.g., "changelog,renderedFields")',
            },
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'jira_search',
        description: 'Search for Jira issues using JQL (Jira Query Language)',
        inputSchema: {
          type: 'object',
          properties: {
            jql: {
              type: 'string',
              description: 'JQL query string (e.g., "project = PROJ AND status = Open")',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 50)',
              default: 50,
            },
            startAt: {
              type: 'number',
              description: 'Starting index for pagination (default: 0)',
              default: 0,
            },
            fields: {
              type: 'string',
              description: 'Comma-separated list of fields to return (optional)',
            },
          },
          required: ['jql'],
        },
      },
      {
        name: 'jira_get_all_projects',
        description: 'List all Jira projects',
        inputSchema: {
          type: 'object',
          properties: {
            expand: {
              type: 'string',
              description: 'Comma-separated list of fields to expand (optional)',
            },
          },
        },
      },
      {
        name: 'jira_get_project',
        description: 'Get details of a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'Project key or ID',
            },
            expand: {
              type: 'string',
              description: 'Comma-separated list of fields to expand (optional)',
            },
          },
          required: ['projectKey'],
        },
      },
      {
        name: 'jira_get_project_issues',
        description: 'Get all issues for a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'Project key',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50)',
              default: 50,
            },
            startAt: {
              type: 'number',
              description: 'Starting index for pagination (default: 0)',
              default: 0,
            },
          },
          required: ['projectKey'],
        },
      },
      {
        name: 'jira_get_worklog',
        description: 'Get worklogs for a specific issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'jira_get_transitions',
        description: 'Get available transitions for an issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'jira_search_fields',
        description: 'Search and get information about Jira fields',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for field names (optional)',
            },
          },
        },
      },
      {
        name: 'jira_get_agile_boards',
        description: 'Get all agile boards',
        inputSchema: {
          type: 'object',
          properties: {
            projectKeyOrId: {
              type: 'string',
              description: 'Filter by project key or ID (optional)',
            },
            type: {
              type: 'string',
              description: 'Filter by board type: scrum or kanban (optional)',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50)',
              default: 50,
            },
          },
        },
      },
      {
        name: 'jira_get_board_issues',
        description: 'Get all issues for a specific board',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: {
              type: 'number',
              description: 'The board ID',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50)',
              default: 50,
            },
            startAt: {
              type: 'number',
              description: 'Starting index for pagination (default: 0)',
              default: 0,
            },
          },
          required: ['boardId'],
        },
      },
      {
        name: 'jira_get_sprints_from_board',
        description: 'Get all sprints from a specific board',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: {
              type: 'number',
              description: 'The board ID',
            },
            state: {
              type: 'string',
              description: 'Filter by sprint state: active, closed, future (optional)',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50)',
              default: 50,
            },
          },
          required: ['boardId'],
        },
      },
      {
        name: 'jira_get_sprint_issues',
        description: 'Get all issues in a specific sprint',
        inputSchema: {
          type: 'object',
          properties: {
            sprintId: {
              type: 'number',
              description: 'The sprint ID',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50)',
              default: 50,
            },
            startAt: {
              type: 'number',
              description: 'Starting index for pagination (default: 0)',
              default: 0,
            },
          },
          required: ['sprintId'],
        },
      },
      {
        name: 'jira_get_issue_link_types',
        description: 'Get all issue link types available in Jira',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'jira_batch_get_changelogs',
        description: 'Get changelogs for multiple issues in batch',
        inputSchema: {
          type: 'object',
          properties: {
            issueKeys: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of issue keys to get changelogs for',
            },
          },
          required: ['issueKeys'],
        },
      },
      {
        name: 'jira_get_user_profile',
        description: 'Get user information by account ID or email',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'User account ID',
            },
            email: {
              type: 'string',
              description: 'User email',
            },
          },
        },
      },
      {
        name: 'jira_download_attachments',
        description: 'Get attachment information for an issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'jira_get_project_versions',
        description: 'Get all versions for a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'Project key or ID',
            },
          },
          required: ['projectKey'],
        },
      },

      // ===== WRITE OPERATIONS =====
      {
        name: 'jira_create_issue',
        description: 'Create a new Jira issue',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project key',
            },
            summary: {
              type: 'string',
              description: 'Issue summary/title',
            },
            description: {
              type: 'string',
              description: 'Issue description',
            },
            issueType: {
              type: 'string',
              description: 'Issue type (e.g., Story, Bug, Task)',
              default: 'Task',
            },
            priority: {
              type: 'string',
              description: 'Priority name (e.g., High, Medium, Low)',
            },
            assignee: {
              type: 'string',
              description: 'Assignee account ID',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of labels',
            },
            parentKey: {
              type: 'string',
              description: 'Parent issue key (for subtasks)',
            },
          },
          required: ['project', 'summary', 'issueType'],
        },
      },
      {
        name: 'jira_update_issue',
        description: 'Update an existing Jira issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
            summary: {
              type: 'string',
              description: 'New summary/title',
            },
            description: {
              type: 'string',
              description: 'New description',
            },
            assignee: {
              type: 'string',
              description: 'Assignee account ID',
            },
            priority: {
              type: 'string',
              description: 'Priority name',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of labels',
            },
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'jira_delete_issue',
        description: 'Delete a Jira issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key to delete',
            },
            deleteSubtasks: {
              type: 'boolean',
              description: 'Whether to delete subtasks (default: false)',
              default: false,
            },
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'jira_batch_create_issues',
        description: 'Create multiple issues in batch',
        inputSchema: {
          type: 'object',
          properties: {
            issues: {
              type: 'array',
              description: 'Array of issue objects to create',
              items: {
                type: 'object',
                properties: {
                  project: { type: 'string' },
                  summary: { type: 'string' },
                  description: { type: 'string' },
                  issueType: { type: 'string' },
                  priority: { type: 'string' },
                  assignee: { type: 'string' },
                },
                required: ['project', 'summary', 'issueType'],
              },
            },
          },
          required: ['issues'],
        },
      },
      {
        name: 'jira_add_comment',
        description: 'Add a comment to a Jira issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
            comment: {
              type: 'string',
              description: 'Comment text',
            },
          },
          required: ['issueKey', 'comment'],
        },
      },
      {
        name: 'jira_transition_issue',
        description: 'Transition an issue to a different status',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
            transition: {
              type: 'string',
              description: 'Transition name or ID',
            },
          },
          required: ['issueKey', 'transition'],
        },
      },
      {
        name: 'jira_add_worklog',
        description: 'Add a worklog entry to an issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
            timeSpent: {
              type: 'string',
              description: 'Time spent (e.g., "3h 30m", "1d 4h")',
            },
            comment: {
              type: 'string',
              description: 'Worklog comment (optional)',
            },
            started: {
              type: 'string',
              description: 'ISO 8601 date-time when work was started (optional)',
            },
          },
          required: ['issueKey', 'timeSpent'],
        },
      },
      {
        name: 'jira_link_to_epic',
        description: 'Link an issue to an epic',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key to link',
            },
            epicKey: {
              type: 'string',
              description: 'The epic issue key',
            },
          },
          required: ['issueKey', 'epicKey'],
        },
      },
      {
        name: 'jira_create_sprint',
        description: 'Create a new sprint',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: {
              type: 'number',
              description: 'The board ID',
            },
            name: {
              type: 'string',
              description: 'Sprint name',
            },
            startDate: {
              type: 'string',
              description: 'ISO 8601 date-time for sprint start (optional)',
            },
            endDate: {
              type: 'string',
              description: 'ISO 8601 date-time for sprint end (optional)',
            },
            goal: {
              type: 'string',
              description: 'Sprint goal (optional)',
            },
          },
          required: ['boardId', 'name'],
        },
      },
      {
        name: 'jira_update_sprint',
        description: 'Update an existing sprint',
        inputSchema: {
          type: 'object',
          properties: {
            sprintId: {
              type: 'number',
              description: 'The sprint ID',
            },
            name: {
              type: 'string',
              description: 'Sprint name',
            },
            state: {
              type: 'string',
              description: 'Sprint state: active, closed, future',
            },
            startDate: {
              type: 'string',
              description: 'ISO 8601 date-time for sprint start',
            },
            endDate: {
              type: 'string',
              description: 'ISO 8601 date-time for sprint end',
            },
            goal: {
              type: 'string',
              description: 'Sprint goal',
            },
          },
          required: ['sprintId'],
        },
      },
      {
        name: 'jira_create_issue_link',
        description: 'Create a link between two issues',
        inputSchema: {
          type: 'object',
          properties: {
            inwardIssue: {
              type: 'string',
              description: 'Inward issue key',
            },
            outwardIssue: {
              type: 'string',
              description: 'Outward issue key',
            },
            linkType: {
              type: 'string',
              description: 'Link type name or ID (e.g., "Blocks", "Relates")',
            },
            comment: {
              type: 'string',
              description: 'Optional comment for the link',
            },
          },
          required: ['inwardIssue', 'outwardIssue', 'linkType'],
        },
      },
      {
        name: 'jira_remove_issue_link',
        description: 'Remove a link between issues',
        inputSchema: {
          type: 'object',
          properties: {
            linkId: {
              type: 'string',
              description: 'The issue link ID to remove',
            },
          },
          required: ['linkId'],
        },
      },
      {
        name: 'jira_assign_issue',
        description: 'Assign an issue to a user',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'The issue key',
            },
            accountId: {
              type: 'string',
              description: 'User account ID',
            },
          },
          required: ['issueKey', 'accountId'],
        },
      },
      {
        name: 'jira_create_version',
        description: 'Create a new version in a project',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Project key or ID',
            },
            name: {
              type: 'string',
              description: 'Version name',
            },
            description: {
              type: 'string',
              description: 'Version description (optional)',
            },
            releaseDate: {
              type: 'string',
              description: 'Release date in YYYY-MM-DD format (optional)',
            },
            released: {
              type: 'boolean',
              description: 'Whether the version is released (default: false)',
              default: false,
            },
          },
          required: ['project', 'name'],
        },
      },
      {
        name: 'jira_batch_create_versions',
        description: 'Create multiple versions in batch',
        inputSchema: {
          type: 'object',
          properties: {
            versions: {
              type: 'array',
              description: 'Array of version objects to create',
              items: {
                type: 'object',
                properties: {
                  project: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  releaseDate: { type: 'string' },
                  released: { type: 'boolean' },
                },
                required: ['project', 'name'],
              },
            },
          },
          required: ['versions'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // Check if connection is valid
    if (connectionError) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Jira connection not available',
            details: connectionError,
            action: 'Please check your JIRA_URL and JIRA_ACCESS_TOKEN configuration'
          }, null, 2),
        }],
        isError: true,
      };
    }
    
    const { name, arguments: args } = request.params;

    switch (name) {
      // ===== READ OPERATIONS =====
      case 'jira_get_issue': {
        const { issueKey, fields, expand } = args as { 
          issueKey: string; 
          fields?: string; 
          expand?: string;
        };
        let endpoint = `/rest/api/2/issue/${issueKey}`;
        const params = new URLSearchParams();
        if (fields) params.append('fields', fields);
        if (expand) params.append('expand', expand);
        if (params.toString()) endpoint += `?${params.toString()}`;
        
        const issue = await callJiraApi(endpoint);
        return {
          content: [{ type: 'text', text: JSON.stringify(issue, null, 2) }],
        };
      }

      case 'jira_search': {
        const { jql, maxResults = 50, startAt = 0, fields } = args as {
          jql: string;
          maxResults?: number;
          startAt?: number;
          fields?: string;
        };
        const params = new URLSearchParams({
          jql,
          maxResults: maxResults.toString(),
          startAt: startAt.toString(),
        });
        if (fields) params.append('fields', fields);
        
        const results = await callJiraApi(`/rest/api/2/search?${params.toString()}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'jira_get_all_projects': {
        const { expand } = args as { expand?: string };
        let endpoint = '/rest/api/2/project';
        if (expand) endpoint += `?expand=${expand}`;
        
        const projects = await callJiraApi(endpoint);
        return {
          content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
        };
      }

      case 'jira_get_project': {
        const { projectKey, expand } = args as { projectKey: string; expand?: string };
        let endpoint = `/rest/api/2/project/${projectKey}`;
        if (expand) endpoint += `?expand=${expand}`;
        
        const project = await callJiraApi(endpoint);
        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
        };
      }

      case 'jira_get_project_issues': {
        const { projectKey, maxResults = 50, startAt = 0 } = args as {
          projectKey: string;
          maxResults?: number;
          startAt?: number;
        };
        const jql = `project = ${projectKey} ORDER BY created DESC`;
        const params = new URLSearchParams({
          jql,
          maxResults: maxResults.toString(),
          startAt: startAt.toString(),
        });
        
        const results = await callJiraApi(`/rest/api/2/search?${params.toString()}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      case 'jira_get_worklog': {
        const { issueKey } = args as { issueKey: string };
        const worklogs = await callJiraApi(`/rest/api/2/issue/${issueKey}/worklog`);
        return {
          content: [{ type: 'text', text: JSON.stringify(worklogs, null, 2) }],
        };
      }

      case 'jira_get_transitions': {
        const { issueKey } = args as { issueKey: string };
        const transitions = await callJiraApi(`/rest/api/2/issue/${issueKey}/transitions`);
        return {
          content: [{ type: 'text', text: JSON.stringify(transitions, null, 2) }],
        };
      }

      case 'jira_search_fields': {
        const { query } = args as { query?: string };
        let endpoint = '/rest/api/2/field';
        if (query) endpoint += `/search?query=${encodeURIComponent(query)}`;
        
        const fields = await callJiraApi(endpoint);
        return {
          content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }],
        };
      }

      case 'jira_get_agile_boards': {
        const { projectKeyOrId, type, maxResults = 50 } = args as {
          projectKeyOrId?: string;
          type?: string;
          maxResults?: number;
        };
        const params = new URLSearchParams({ maxResults: maxResults.toString() });
        if (projectKeyOrId) params.append('projectKeyOrId', projectKeyOrId);
        if (type) params.append('type', type);
        
        const boards = await callJiraApi(`/rest/agile/1.0/board?${params.toString()}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(boards, null, 2) }],
        };
      }

      case 'jira_get_board_issues': {
        const { boardId, maxResults = 50, startAt = 0 } = args as {
          boardId: number;
          maxResults?: number;
          startAt?: number;
        };
        const params = new URLSearchParams({
          maxResults: maxResults.toString(),
          startAt: startAt.toString(),
        });
        
        const issues = await callJiraApi(`/rest/agile/1.0/board/${boardId}/issue?${params.toString()}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }],
        };
      }

      case 'jira_get_sprints_from_board': {
        const { boardId, state, maxResults = 50 } = args as {
          boardId: number;
          state?: string;
          maxResults?: number;
        };
        const params = new URLSearchParams({ maxResults: maxResults.toString() });
        if (state) params.append('state', state);
        
        const sprints = await callJiraApi(`/rest/agile/1.0/board/${boardId}/sprint?${params.toString()}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(sprints, null, 2) }],
        };
      }

      case 'jira_get_sprint_issues': {
        const { sprintId, maxResults = 50, startAt = 0 } = args as {
          sprintId: number;
          maxResults?: number;
          startAt?: number;
        };
        const params = new URLSearchParams({
          maxResults: maxResults.toString(),
          startAt: startAt.toString(),
        });
        
        const issues = await callJiraApi(`/rest/agile/1.0/sprint/${sprintId}/issue?${params.toString()}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }],
        };
      }

      case 'jira_get_issue_link_types': {
        const linkTypes = await callJiraApi('/rest/api/2/issueLinkType');
        return {
          content: [{ type: 'text', text: JSON.stringify(linkTypes, null, 2) }],
        };
      }

      case 'jira_batch_get_changelogs': {
        const { issueKeys } = args as { issueKeys: string[] };
        const changelogs = await Promise.all(
          issueKeys.map(async (key) => {
            try {
              const issue = await callJiraApi(`/rest/api/2/issue/${key}?expand=changelog`);
              return { issueKey: key, changelog: issue.changelog };
            } catch (error) {
              return { issueKey: key, error: (error as Error).message };
            }
          })
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(changelogs, null, 2) }],
        };
      }

      case 'jira_get_user_profile': {
        const { accountId, email } = args as { accountId?: string; email?: string };
        let endpoint = '/rest/api/2/user';
        
        if (accountId) {
          endpoint += `?accountId=${encodeURIComponent(accountId)}`;
        } else if (email) {
          endpoint = `/rest/api/2/user/search?query=${encodeURIComponent(email)}`;
        } else {
          throw new Error('Either accountId or email must be provided');
        }

        const user = await callJiraApi(endpoint);
        return {
          content: [{ type: 'text', text: JSON.stringify(user, null, 2) }],
        };
      }

      case 'jira_download_attachments': {
        const { issueKey } = args as { issueKey: string };
        const issue = await callJiraApi(`/rest/api/2/issue/${issueKey}?fields=attachment`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              issueKey,
              attachments: issue.fields?.attachment || [],
            }, null, 2),
          }],
        };
      }

      case 'jira_get_project_versions': {
        const { projectKey } = args as { projectKey: string };
        const versions = await callJiraApi(`/rest/api/2/project/${projectKey}/versions`);
        return {
          content: [{ type: 'text', text: JSON.stringify(versions, null, 2) }],
        };
      }

      // ===== WRITE OPERATIONS =====
      case 'jira_create_issue': {
        const { project, summary, description, issueType, priority, assignee, labels, parentKey } = args as {
          project: string;
          summary: string;
          description?: string;
          issueType: string;
          priority?: string;
          assignee?: string;
          labels?: string[];
          parentKey?: string;
        };

        const fields: any = {
          project: { key: project },
          summary,
          issuetype: { name: issueType },
        };

        if (description) {
          fields.description = {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: description }],
            }],
          };
        }

        if (priority) fields.priority = { name: priority };
        if (assignee) fields.assignee = { id: assignee };
        if (labels && labels.length > 0) fields.labels = labels;
        if (parentKey) fields.parent = { key: parentKey };

        const issue = await callJiraApi('/rest/api/2/issue', 'POST', { fields });
        return {
          content: [{ type: 'text', text: JSON.stringify(issue, null, 2) }],
        };
      }

      case 'jira_update_issue': {
        const { issueKey, summary, description, assignee, priority, labels } = args as {
          issueKey: string;
          summary?: string;
          description?: string;
          assignee?: string;
          priority?: string;
          labels?: string[];
        };

        const fields: any = {};

        if (summary) fields.summary = summary;
        if (description) {
          fields.description = {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: description }],
            }],
          };
        }
        if (assignee) fields.assignee = { id: assignee };
        if (priority) fields.priority = { name: priority };
        if (labels) fields.labels = labels;

        await callJiraApi(`/rest/api/2/issue/${issueKey}`, 'PUT', { fields });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, message: 'Issue updated successfully' }, null, 2),
          }],
        };
      }

      case 'jira_delete_issue': {
        const { issueKey, deleteSubtasks = false } = args as {
          issueKey: string;
          deleteSubtasks?: boolean;
        };
        const endpoint = `/rest/api/2/issue/${issueKey}?deleteSubtasks=${deleteSubtasks}`;
        await callJiraApi(endpoint, 'DELETE');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, message: 'Issue deleted successfully' }, null, 2),
          }],
        };
      }

      case 'jira_batch_create_issues': {
        const { issues } = args as { issues: any[] };
        const issueUpdates = issues.map((issue) => {
          const fields: any = {
            project: { key: issue.project },
            summary: issue.summary,
            issuetype: { name: issue.issueType },
          };

          if (issue.description) {
            fields.description = {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: issue.description }],
              }],
            };
          }

          if (issue.priority) fields.priority = { name: issue.priority };
          if (issue.assignee) fields.assignee = { id: issue.assignee };

          return { fields };
        });

        const result = await callJiraApi('/rest/api/2/issue/bulk', 'POST', { issueUpdates });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'jira_add_comment': {
        const { issueKey, comment } = args as { issueKey: string; comment: string };
        const result = await callJiraApi(`/rest/api/2/issue/${issueKey}/comment`, 'POST', {
          body: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: comment }],
            }],
          },
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'jira_transition_issue': {
        const { issueKey, transition } = args as { issueKey: string; transition: string };
        
        const transitions = await callJiraApi(`/rest/api/2/issue/${issueKey}/transitions`);
        const targetTransition = (transitions.transitions || []).find(
          (t: any) => t.name === transition || t.id === transition
        );

        if (!targetTransition) {
          throw new Error(`Transition "${transition}" not found. Available: ${
            (transitions.transitions || []).map((t: any) => t.name).join(', ')
          }`);
        }

        await callJiraApi(`/rest/api/2/issue/${issueKey}/transitions`, 'POST', {
          transition: { id: targetTransition.id },
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Issue transitioned to ${targetTransition.name}`,
            }, null, 2),
          }],
        };
      }

      case 'jira_add_worklog': {
        const { issueKey, timeSpent, comment, started } = args as {
          issueKey: string;
          timeSpent: string;
          comment?: string;
          started?: string;
        };

        const body: any = { timeSpent };
        if (comment) body.comment = comment;
        if (started) body.started = started;

        const result = await callJiraApi(`/rest/api/2/issue/${issueKey}/worklog`, 'POST', body);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'jira_link_to_epic': {
        const { issueKey, epicKey } = args as { issueKey: string; epicKey: string };
        
        // Get epic link field ID
        const fields = await callJiraApi('/rest/api/2/field');
        const epicLinkField = fields.find((f: any) => f.name === 'Epic Link' || f.id === 'customfield_10014');
        
        if (!epicLinkField) {
          throw new Error('Epic Link field not found');
        }

        await callJiraApi(`/rest/api/2/issue/${issueKey}`, 'PUT', {
          fields: {
            [epicLinkField.id]: epicKey,
          },
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, message: `Issue ${issueKey} linked to epic ${epicKey}` }, null, 2),
          }],
        };
      }

      case 'jira_create_sprint': {
        const { boardId, name, startDate, endDate, goal } = args as {
          boardId: number;
          name: string;
          startDate?: string;
          endDate?: string;
          goal?: string;
        };

        const body: any = {
          name,
          originBoardId: boardId,
        };
        if (startDate) body.startDate = startDate;
        if (endDate) body.endDate = endDate;
        if (goal) body.goal = goal;

        const sprint = await callJiraApi('/rest/agile/1.0/sprint', 'POST', body);
        return {
          content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }],
        };
      }

      case 'jira_update_sprint': {
        const { sprintId, name, state, startDate, endDate, goal } = args as {
          sprintId: number;
          name?: string;
          state?: string;
          startDate?: string;
          endDate?: string;
          goal?: string;
        };

        const body: any = {};
        if (name) body.name = name;
        if (state) body.state = state;
        if (startDate) body.startDate = startDate;
        if (endDate) body.endDate = endDate;
        if (goal) body.goal = goal;

        const sprint = await callJiraApi(`/rest/agile/1.0/sprint/${sprintId}`, 'POST', body);
        return {
          content: [{ type: 'text', text: JSON.stringify(sprint, null, 2) }],
        };
      }

      case 'jira_create_issue_link': {
        const { inwardIssue, outwardIssue, linkType, comment } = args as {
          inwardIssue: string;
          outwardIssue: string;
          linkType: string;
          comment?: string;
        };

        const body: any = {
          type: { name: linkType },
          inwardIssue: { key: inwardIssue },
          outwardIssue: { key: outwardIssue },
        };

        if (comment) {
          body.comment = {
            body: {
              type: 'doc',
              version: 1,
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: comment }],
              }],
            },
          };
        }

        await callJiraApi('/rest/api/2/issueLink', 'POST', body);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, message: 'Issue link created' }, null, 2),
          }],
        };
      }

      case 'jira_remove_issue_link': {
        const { linkId } = args as { linkId: string };
        await callJiraApi(`/rest/api/2/issueLink/${linkId}`, 'DELETE');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, message: 'Issue link removed' }, null, 2),
          }],
        };
      }

      case 'jira_assign_issue': {
        const { issueKey, accountId } = args as { issueKey: string; accountId: string };
        await callJiraApi(`/rest/api/2/issue/${issueKey}/assignee`, 'PUT', { accountId });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, message: 'Issue assigned successfully' }, null, 2),
          }],
        };
      }

      case 'jira_create_version': {
        const { project, name, description, releaseDate, released = false } = args as {
          project: string;
          name: string;
          description?: string;
          releaseDate?: string;
          released?: boolean;
        };

        const body: any = {
          name,
          project,
          released,
        };
        if (description) body.description = description;
        if (releaseDate) body.releaseDate = releaseDate;

        const version = await callJiraApi('/rest/api/2/version', 'POST', body);
        return {
          content: [{ type: 'text', text: JSON.stringify(version, null, 2) }],
        };
      }

      case 'jira_batch_create_versions': {
        const { versions } = args as { versions: any[] };
        const results = await Promise.all(
          versions.map(async (version) => {
            try {
              const body: any = {
                name: version.name,
                project: version.project,
                released: version.released || false,
              };
              if (version.description) body.description = version.description;
              if (version.releaseDate) body.releaseDate = version.releaseDate;

              const result = await callJiraApi('/rest/api/2/version', 'POST', body);
              return { success: true, version: result };
            } catch (error) {
              return { success: false, error: (error as Error).message, versionName: version.name };
            }
          })
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`Error executing tool ${request.params.name}:`, errorMessage);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Failed to execute Jira operation',
          tool: request.params.name,
          details: errorMessage,
          suggestion: errorMessage.includes('401') || errorMessage.includes('Unauthorized')
            ? 'Your access token may have expired. Please generate a new one.'
            : errorMessage.includes('403') || errorMessage.includes('Forbidden')
            ? 'You do not have permission to perform this operation.'
            : errorMessage.includes('404')
            ? 'The requested resource was not found. Check if the issue/project key is correct.'
            : 'Please check the error details and try again.'
        }, null, 2),
      }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('='.repeat(60));
  console.error('Jira MCP Server v2.4.0');
  console.error('='.repeat(60));
  console.error(`JIRA_URL: ${JIRA_URL}`);
  console.error('Status: Server started successfully');
  console.error('Note: Connection will be validated on first tool request');
  console.error('='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
