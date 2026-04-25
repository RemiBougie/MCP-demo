import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { NextRequest } from 'next/server';
import { ColumnMeta, Row } from '@/lib/types';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:8000/mcp';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a SQL analytics assistant connected to a financial Azure SQL database.

Tables available:
- accounts: customer account information
- transactions: financial transactions
- portfolios: investment portfolios
- positions: individual holdings within portfolios
- market_prices: current and historical asset prices
- dividends: dividend payment records

## When the user asks about data, metrics, or anything answerable with SQL:
1. Optionally call get_database_overview or get_table_schema to understand the schema.
2. Call execute_query with a valid T-SQL SELECT statement.
3. execute_query returns ONLY column names and row count — the actual rows are sent directly to the UI and are NOT visible to you. Do not ask for the data again.
4. Call render_component immediately after execute_query. render_component will fail if called before execute_query. Choose the best component:
   - Head: raw record preview (default when no chart makes sense).
   - BarChart: comparisons across categories (e.g. total by account, count by type). Shape your query so the first column is the label and remaining columns are numeric.
   - Timeline: trends over time (e.g. daily prices, monthly totals). Shape your query so the first column is a date/datetime and remaining columns are numeric values.
5. Write a short explanation of what the query returned (row count, what columns represent, any key insight). Do not list individual row values since you cannot see them.

## When the user asks general questions (capabilities, what you can do, how to use you, etc.):
Answer directly in plain text. Do not call any tools.`;

type AnthropicTool = Anthropic.Tool;

interface McpToolResult {
  columns?: ColumnMeta[];
  row_count?: number;
  rows?: Row[];
  [key: string]: unknown;
}

interface QueryData {
  columns: ColumnMeta[];
  data: Row[];
}

function convertMcpToolsToAnthropic(
  tools: Array<{ name: string; description?: string; inputSchema: unknown }>
): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    input_schema: tool.inputSchema as AnthropicTool['input_schema'],
  }));
}

const renderComponentTool: AnthropicTool = {
  name: 'render_component',
  description:
    'Select a UI component to visualize the SQL query results. Call this after execute_query.',
  input_schema: {
    type: 'object',
    properties: {
      component: {
        type: 'string',
        enum: ['Head', 'BarChart', 'Timeline'],
        description: [
          'Head: shows the first 10 rows as a table. Best for raw record previews.',
          'BarChart: renders a bar chart. First column must be the category label; remaining columns are numeric series (one bar group per series). Supports multiple bars per category. Orientation (vertical/horizontal) is chosen automatically.',
          'Timeline: renders a line chart over time. First column must be a datetime; remaining columns are numeric values plotted as separate lines on the y-axis.',
        ].join(' '),
      },
    },
    required: ['component'],
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, history } = body as {
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
  };

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const mcpClient = new Client({ name: 'mcp-next-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));

  try {
    await mcpClient.connect(transport);

    // Fetch MCP tools and convert to Anthropic format
    const mcpToolsResponse = await mcpClient.listTools();
    const mcpTools = convertMcpToolsToAnthropic(mcpToolsResponse.tools);
    const allTools: AnthropicTool[] = [...mcpTools, renderComponentTool];

    // Build conversation messages from history + new user message
    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    let finalText = '';
    // Each execute_query result waits here until the following render_component pairs with it
    let pendingQueryData: QueryData | null = null;
    const visualizations: { component: string; columns: ColumnMeta[]; data: Row[] }[] = [];

    // Agentic loop
    while (true) {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: allTools,
        messages,
      });

      // Accumulate text from all text blocks in this turn
      for (const block of response.content) {
        if (block.type === 'text') {
          finalText += block.text;
        }
      }

      if (response.stop_reason === 'end_turn') {
        break;
      }

      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // Add assistant message to conversation
      messages.push({ role: 'assistant', content: response.content });

      // Process each tool use block
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const toolName = block.name;
        const toolInput = block.input as Record<string, unknown>;

        if (toolName === 'render_component') {
          if (!pendingQueryData) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: 'ERROR: You must call execute_query before render_component. Run execute_query first, then call render_component.',
              is_error: true,
            });
          } else {
            visualizations.push({
              component: toolInput.component as string,
              columns: pendingQueryData.columns,
              data: pendingQueryData.data,
            });
            pendingQueryData = null;
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: 'acknowledged',
            });
          }
        } else if (toolName === 'execute_query') {
          // Call the real MCP tool
          const mcpResult = await mcpClient.callTool({
            name: toolName,
            arguments: toolInput,
          });

          // Parse the result — handle both structuredContent (FastMCP 3.x) and text content
          let parsed: McpToolResult = {};
          try {
            if ((mcpResult as Record<string, unknown>).structuredContent) {
              parsed = (mcpResult as Record<string, unknown>).structuredContent as McpToolResult;
            } else {
              const rawText =
                Array.isArray(mcpResult.content) && mcpResult.content[0]?.type === 'text'
                  ? (mcpResult.content[0] as { type: 'text'; text: string }).text
                  : JSON.stringify(mcpResult.content);
              parsed = JSON.parse(rawText);
            }
          } catch (e) {
            console.error('[execute_query] parse error:', e);
            parsed = {};
          }
          // server returns columns as [{name: string}, ...] and rows as [[val, ...], ...]
          const rawColumns: ColumnMeta[] = Array.isArray(parsed.columns) ? parsed.columns : [];
          const rawRows: Row[] = Array.isArray(parsed.rows) ? parsed.rows : [];

          // Store full data, waiting for the next render_component call to pair with it
          pendingQueryData = { columns: rawColumns, data: rawRows };

          // Return only column names + row_count to Claude (no row data)
          const claudeView = {
            columns: rawColumns.map((c) => c.name),
            row_count: parsed.row_count ?? rawRows.length,
          };

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(claudeView),
          });
        } else {
          // All other MCP tools — call and return full result
          const mcpResult = await mcpClient.callTool({
            name: toolName,
            arguments: toolInput,
          });

          const resultText =
            Array.isArray(mcpResult.content) && mcpResult.content[0]?.type === 'text'
              ? (mcpResult.content[0] as { type: 'text'; text: string }).text
              : JSON.stringify(mcpResult.content);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultText,
          });
        }
      }

      // Add tool results to conversation
      messages.push({ role: 'user', content: toolResults });
    }

    // If a query ran but the model skipped render_component, default to Head
    if (pendingQueryData) {
      visualizations.push({ component: 'Head', columns: pendingQueryData.columns, data: pendingQueryData.data });
    }

    return Response.json({
      text: finalText,
      visualizations,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  } finally {
    await mcpClient.close();
  }
}
