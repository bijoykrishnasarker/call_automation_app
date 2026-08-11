/**
 * Single MCP tool entry pointing at this app's Streamable HTTP MCP server (`/api/mcp`).
 * Vapi discovers `check_availability`, `book_appointment`, `take_message`, etc. via MCP.
 *
 * Opt-in via `VAPI_ASSISTANT_MCP_ENABLED=true`. Default sync uses webhook function tools instead
 * because Azure OpenAI rejects MCP when Vapi maps it to `tools[n].function.name` as empty.
 */
export function buildBookingMcpTool(baseUrl: string): {
  type: 'mcp';
  server: { url: string; timeoutSeconds: number };
  metadata: { protocol: 'shttp' };
} {
  const root = baseUrl.replace(/\/$/, '');
  return {
    type: 'mcp',
    server: {
      url: `${root}/api/mcp`,
      timeoutSeconds: 45,
    },
    metadata: {
      protocol: 'shttp',
    },
  };
}
