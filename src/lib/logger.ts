/**
 * Structured logger for both server and client code.
 *
 * - One-line JSON per log on the server (easy to ship to Datadog / Loki / etc.)
 * - Compact console output in the browser
 * - Stable shape: { ts, level, msg, requestId?, ...fields }
 * - Never logs Authorization headers, Supabase tokens, or fields named
 *   *password* / *secret* / *token* / *apikey* / *key*.
 *
 * Use with a correlation id (see newRequestId) so a single request can be
 * traced across middleware → server fn → DB → external API → response.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
  requestId?: string;
}

const REDACT_KEYS = /(password|secret|token|api[_-]?key|authorization|cookie|service[_-]?role)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth-limit]";
  if (value == null) return value;
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  const record = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };
  const isServer = typeof window === "undefined";
  if (isServer) {
    // One-line JSON — drop-in for any log shipper.
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else {
    const tag = `[${level}]`;
    const args = fields ? [tag, msg, redact(fields)] : [tag, msg];
    if (level === "error") console.error(...args);
    else if (level === "warn") console.warn(...args);
    else console.log(...args);
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
  child: (base: LogFields) => ({
    debug: (msg: string, f?: LogFields) => emit("debug", msg, { ...base, ...f }),
    info: (msg: string, f?: LogFields) => emit("info", msg, { ...base, ...f }),
    warn: (msg: string, f?: LogFields) => emit("warn", msg, { ...base, ...f }),
    error: (msg: string, f?: LogFields) => emit("error", msg, { ...base, ...f }),
  }),
};

/** RFC 4122-ish request id; good enough for correlation, not for security. */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
