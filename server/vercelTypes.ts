import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Lightweight request/response interfaces compatible with both
 * Vercel Node.js Serverless Functions and Express middleware handlers.
 */
export interface ApiRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(data: unknown): void;
  send(body: string | Buffer | Uint8Array): void;
}
