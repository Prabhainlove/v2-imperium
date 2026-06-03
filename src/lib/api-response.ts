/**
 * Standard API response envelope (Phase D).
 *
 * Every server function and server route returns:
 *   { success: true,  data, meta? }
 *   { success: false, error: { code, message, requestId }, meta? }
 *
 * - `code` is a stable machine-readable string (e.g. UNAUTHORIZED, VALIDATION_ERROR).
 * - `message` is human-readable and SAFE to show to end users (no stack, no internals).
 * - `requestId` correlates the client error with structured server logs (logger.ts).
 *
 * Server-side: wrap handlers with `envelope()` so all errors are caught, logged
 * with full detail, and returned as a redacted envelope.
 */
import { logger, newRequestId } from "@/lib/logger";
import { ZodError } from "zod";

export interface ApiMeta {
  requestId?: string;
  durationMs?: number;
  [k: string]: unknown;
}

export interface ApiOk<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: ApiErrorCode | string;
    message: string;
    requestId: string;
  };
  meta?: ApiMeta;
}

export type ApiResponse<T> = ApiOk<T> | ApiError;

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "AI_PROVIDER_ERROR"
  | "DATABASE_ERROR"
  | "UPLOAD_ERROR"
  | "EXPORT_ERROR"
  | "AUTH_ERROR"
  | "INTERNAL_ERROR";

/** Typed error you can throw inside a server fn handler to control the envelope. */
export class AppError extends Error {
  public readonly code: ApiErrorCode | string;
  public readonly httpStatus: number;
  public readonly safeMessage: string;
  public readonly cause?: unknown;

  constructor(
    code: ApiErrorCode | string,
    safeMessage: string,
    opts: { httpStatus?: number; cause?: unknown } = {}
  ) {
    super(safeMessage);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = opts.httpStatus ?? defaultStatusForCode(code);
    this.safeMessage = safeMessage;
    this.cause = opts.cause;
  }
}

function defaultStatusForCode(code: string): number {
  switch (code) {
    case "UNAUTHORIZED": return 401;
    case "FORBIDDEN": return 403;
    case "NOT_FOUND": return 404;
    case "VALIDATION_ERROR": return 422;
    case "RATE_LIMITED": return 429;
    case "AI_PROVIDER_ERROR": return 502;
    case "DATABASE_ERROR": return 500;
    case "UPLOAD_ERROR": return 400;
    case "EXPORT_ERROR": return 500;
    case "AUTH_ERROR": return 401;
    default: return 500;
  }
}

export function ok<T>(data: T, meta?: ApiMeta): ApiOk<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function fail(
  code: ApiErrorCode | string,
  message: string,
  requestId: string,
  meta?: ApiMeta
): ApiError {
  return {
    success: false,
    error: { code, message, requestId },
    ...(meta ? { meta } : {}),
  };
}

/**
 * Wrap a server-fn handler so:
 *   - a fresh requestId is generated per call
 *   - duration is measured
 *   - thrown AppError / ZodError / unknown errors are converted to ApiError
 *   - logs include full detail server-side; client sees only safe envelope
 *
 * Usage:
 *   .handler(envelope("getProfile", async ({ context, requestId }) => {
 *     const profile = await loadProfile(context.userId);
 *     return profile; // automatically wrapped as { success: true, data: profile }
 *   }))
 */
export function envelope<TCtx, TOut>(
  operation: string,
  fn: (args: TCtx & { requestId: string }) => Promise<TOut>
): (args: TCtx) => Promise<ApiResponse<TOut>> {
  return async (args: TCtx): Promise<ApiResponse<TOut>> => {
    const requestId = newRequestId();
    const startedAt = Date.now();
    const log = logger.child({ requestId, operation });
    try {
      log.info("op.start");
      const data = await fn({ ...args, requestId });
      const durationMs = Date.now() - startedAt;
      log.info("op.ok", { durationMs });
      return ok(data, { requestId, durationMs });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      // TanStack control-flow (redirect/notFound) — rethrow so the router handles it.
      if (err != null && typeof err === "object" && "statusCode" in err) throw err;

      if (err instanceof ZodError) {
        log.warn("op.validation_failed", { durationMs, issues: err.issues });
        return fail("VALIDATION_ERROR", "Invalid input.", requestId, { durationMs });
      }
      if (err instanceof AppError) {
        log.warn("op.app_error", {
          durationMs,
          code: err.code,
          cause: err.cause instanceof Error ? err.cause.message : err.cause,
        });
        return fail(err.code, err.safeMessage, requestId, { durationMs });
      }
      // Unknown error — log full detail, return generic message.
      log.error("op.unhandled", {
        durationMs,
        error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      });
      return fail(
        "INTERNAL_ERROR",
        "Something went wrong. Please try again.",
        requestId,
        { durationMs }
      );
    }
  };
}

/** Convenience for unwrapping on the client. Throws AppError-like on failure. */
export function unwrap<T>(res: ApiResponse<T>): T {
  if (res.success) return res.data;
  const err = new Error(res.error.message) as Error & {
    code: string;
    requestId: string;
  };
  err.code = res.error.code;
  err.requestId = res.error.requestId;
  throw err;
}
