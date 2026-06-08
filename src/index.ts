interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * macvendors.com MCP — MAC address (OUI) → hardware manufacturer lookup.
 * Keyless. Free tier rate-limited to ~1 request/second.
 */


const BASE = 'https://api.macvendors.com';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'lookup',
    description:
      'macvendors.com = MAC address → hardware manufacturer (OUI) lookup; pass a full MAC or just the first 6 hex digits. Keyless; free tier is rate-limited to ~1 request/second.',
    inputSchema: {
      type: 'object',
      properties: {
        mac: {
          type: 'string',
          description:
            'A MAC address or at least the first 6 hex digits (the OUI). Separators (colons, hyphens, dots, spaces) or none all accepted, e.g. "FC:FB:FB:01:02:03", "FC-FB-FB", or "fcfbfb".',
        },
      },
      required: ['mac'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'lookup':
      return lookup(args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function lookup(args: Record<string, unknown>): Promise<unknown> {
  const raw = typeof args.mac === 'string' ? args.mac.trim() : '';
  const hex = raw.replace(/[:\-.\s]/g, '');
  if ((hex.match(/[0-9a-fA-F]/g)?.length ?? 0) < 6) {
    return { error: 'provide a MAC address or OUI (at least 6 hex digits)' };
  }
  const mac = raw;
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(mac)}`, {
      headers: { 'User-Agent': UA },
    });
    if (res.status === 200) {
      const text = (await res.text()).trim();
      return { mac, vendor: text };
    }
    if (res.status === 404) {
      return { mac, vendor: null, note: 'no registered vendor for this OUI' };
    }
    if (res.status === 429) {
      return { error: 'macvendors rate limit (free tier ~1/sec); try again shortly', mac };
    }
    return { error: `macvendors error: ${res.status}`, mac };
  } catch (e) {
    return { error: `macvendors error: ${(e as Error).message}`, mac };
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
