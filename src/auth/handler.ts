import { auth } from './index';

// Better Auth handler for HTTP requests
export function authHandler(request: Request): Promise<Response> {
  return auth.handler(request);
}
