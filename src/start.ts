import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "@shared/utils/errorPage";
import { attachSupabaseAuth } from "@backend/database/AuthAttacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, serverFnMeta, next }) => {
    if (serverFnMeta) {
      const site = request.headers.get("sec-fetch-site");
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");
      const sameOrigin = !origin || !host || new URL(origin).host === host;

      if ((site && site !== "same-origin" && site !== "same-site") || !sameOrigin) {
        return new Response("Invalid server function origin", { status: 403 });
      }
    }
    return next();
  },
);

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
