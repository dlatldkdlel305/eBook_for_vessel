import { handleHealth } from '../server/handlers.js';
import type { ApiRequest, ApiResponse } from '../server/vercelTypes.js';

export default async function handler(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  await handleHealth(req, res);
}
