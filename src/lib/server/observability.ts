import { randomUUID } from "node:crypto";

/**
 * Structured error reporting.
 *
 * Two constraints shape this. First, the product serves children, so a report must never carry
 * quiz answers, names, tokens, or raw request bodies — only identifiers that are already opaque.
 * Second, KFI will operate this without the team that built it, so a report has to say *which*
 * environment, release, and subsystem failed, not just that something did.
 *
 * `report` writes structured JSON to the server log, which Vercel already collects and which any
 * log drain can forward. `setErrorSink` is the seam for a hosted error tracker: wire it once in
 * instrumentation and every existing call site starts reporting there, with no other changes.
 */

export type ErrorScope =
  | "api"
  | "page"
  | "database"
  | "unity-boot"
  | "unity-bridge"
  | "progress-save"
  | "quiz-save"
  | "classroom";

export type ErrorReport = {
  scope: ErrorScope;
  event: string;
  correlationId: string;
  environment: string;
  release: string | null;
  message: string;
  stack?: string;
  context: Record<string, string | number | boolean | null>;
  occurredAt: string;
};

type ErrorSink = (report: ErrorReport) => void;

let sink: ErrorSink | null = null;

export function setErrorSink(next: ErrorSink | null) {
  sink = next;
}

export function newCorrelationId() {
  return randomUUID();
}

/**
 * Vercel exposes the deploying commit here, which is what makes an alert actionable: it identifies
 * the exact release rather than "production".
 */
export function currentRelease() {
  return process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_RELEASE_SHA ?? null;
}

function currentEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

/**
 * Context values are restricted to primitives and are expected to be non-identifying: ids that are
 * already opaque, counts, route names. Anything object-shaped is dropped rather than serialized,
 * so a whole request body cannot be attached by accident.
 */
function sanitizeContext(context: Record<string, unknown> = {}): ErrorReport["context"] {
  const safe: ErrorReport["context"] = {};

  for (const [key, value] of Object.entries(context)) {
    if (value === null) {
      safe[key] = null;
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }

  return safe;
}

export function reportError(input: {
  scope: ErrorScope;
  event: string;
  error: unknown;
  correlationId?: string;
  context?: Record<string, unknown>;
}): ErrorReport {
  const error = input.error;
  const report: ErrorReport = {
    scope: input.scope,
    event: input.event,
    correlationId: input.correlationId ?? newCorrelationId(),
    environment: currentEnvironment(),
    release: currentRelease(),
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    context: sanitizeContext(input.context),
    occurredAt: new Date().toISOString(),
  };

  // Structured single-line JSON so a log drain can parse and alert on it without regex archaeology.
  console.error(JSON.stringify({ level: "error", ...report }));

  try {
    sink?.(report);
  } catch (sinkError) {
    console.error("Error sink threw:", sinkError);
  }

  return report;
}
