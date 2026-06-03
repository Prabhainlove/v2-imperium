import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "@/lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { logger, newRequestId } from "@/lib/logger";

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
const observabilityMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const requestId = newRequestId();
  const startedAt = Date.now();
  try {
    const result = await next();
    const duration = Date.now() - startedAt;
    // TanStack request middleware returns a ctx-like object; the SSR Response
    // lives on `.response`. Mutate it in place so the body/stream is preserved.
    const response: Response | undefined = (result as { response?: Response })?.response;
    if (response) {
      response.headers.set("x-request-id", requestId);
      applySecurityHeaders(response);
      logger.info("request.complete", {
        requestId,
        status: response.status,
        durationMs: duration,
      });
    }
    return result;
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const duration = Date.now() - startedAt;
    logger.error("request.failed", {
      requestId,
      durationMs: duration,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    throw error;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [observabilityMiddleware],
}));
