import 'server-only';
import type { z } from 'zod';
import { HttpError } from './server';

/**
 * Reads a JSON request body and parses it with `schema` before any field is
 * used (SEC-004). A missing or malformed body is treated as `undefined`, so a
 * schema can accept an empty body by being optional. On failure the client
 * gets `message` as a 400, never the parser's own description of the input.
 */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S, message: string): Promise<z.output<S>> {
  const body: unknown = await req.json().catch(() => undefined);
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, message);
  return result.data;
}
