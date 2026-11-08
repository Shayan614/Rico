export type MCPProtocolVersion = "2024-11-05" | "latest";

export type MCPServerTransport = "SSE" | "HTTP" | "IN_PROCESS";

export type MCPServerStatus =
  | "CONNECTED"
  | "CONNECTING"
  | "DISCONNECTED"
  | "ERROR";

export interface MCPToolInputSchema {
  type: "object";
  properties: Record<string, { type: string; description?: string; default?: unknown }>;
  required?: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
  serverName: string;
  serverId: string;
  isFinancial: boolean;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  endpointUrl: string;
  transport?: MCPServerTransport;
  authToken?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  mockTools?: MCPTool[];
  mockExecutor?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface MCPServerState {
  id: string;
  name: string;
  endpointUrl: string;
  status: MCPServerStatus;
  transport: MCPServerTransport;
  tools: MCPTool[];
  latencyMs: number;
  lastConnectedAt?: string;
  error?: string;
}

export interface MCPContentItem {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface MCPToolCallResult<T = unknown> {
  success: boolean;
  toolName: string;
  serverName: string;
  content: MCPContentItem[];
  data?: T;
  isError: boolean;
  latencyMs: number;
  guardrailBlocked?: boolean;
  guardrailReason?: string;
}

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
