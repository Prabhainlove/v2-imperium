import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { logger, newRequestId } from "./lib/logger";

/**
 * Baseline security response headers applied to every request.
 * CSP is intentionally omitted here — define a strict CSP at the edge
 * (Cloudflare / nginx / Traefik) per docs/SECURITY.md, where you control
 * the exact origins for your deployment.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
};

function applySecurityHeaders(res: Response): Response {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(k)) res.headers.set(k, v);
  }
  return res;
}

/**
 * Global request middleware:
 *   - assigns a correlation/request id
 *   - structured-logs request start + completion (status, duration)
 *   - catches unhandled errors and returns a styled 500 page
 *   - applies baseline security headers to every response
 */
const observabilityMiddleware = createMiddleware().server(async ({ next }) => {
  const requestId = newRequestId();
  const startedAt = Date.now();
  try {
    const res = await next();
    const duration = Date.now() - startedAt;
    const response = res instanceof Response ? res : new Response(null);
    response.headers.set("x-request-id", requestId);
    logger.info("request.complete", {
      requestId,
      status: response.status,
      durationMs: duration,
    });
    return applySecurityHeaders(response);
  } catch (error) {
    // TanStack control-flow errors (redirect, notFound) carry statusCode — rethrow.
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const duration = Date.now() - startedAt;
    logger.error("request.failed", {
      requestId,
      durationMs: duration,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    const response = new Response(renderErrorPage(), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-request-id": requestId,
      },
    });
    return applySecurityHeaders(response);
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [observabilityMiddleware],
}));
