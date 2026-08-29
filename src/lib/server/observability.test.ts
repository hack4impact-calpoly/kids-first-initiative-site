import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError, setErrorSink } from "@/lib/server/observability";

describe("reportError", () => {
  afterEach(() => {
    setErrorSink(null);
    vi.restoreAllMocks();
  });

  it("never carries object-shaped context, so a request body cannot be attached by accident", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const report = reportError({
      scope: "quiz-save",
      event: "save-failed",
      error: new Error("boom"),
      context: {
        quizId: "quiz-1",
        attempt: 2,
        retried: true,
        empty: null,
        // All of the below are the shapes that would leak a child's data.
        answers: [{ questionId: "q1", selectedAnswer: "Solid" }],
        student: { name: "Ada", clerkId: "user_2abc" },
        requestBody: { statesOfMatterQuestionResults: [] },
      },
    });

    expect(report.context).toEqual({ quizId: "quiz-1", attempt: 2, retried: true, empty: null });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("Solid");
    expect(serialized).not.toContain("Ada");
    expect(serialized).not.toContain("user_2abc");
  });

  it("distinguishes a WebGL boot failure from a save failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const boot = reportError({ scope: "unity-boot", event: "load-failed", error: new Error("no wasm") });
    const save = reportError({ scope: "progress-save", event: "save-failed", error: new Error("503") });

    // An alert has to be able to tell these apart; they need different responses.
    expect(boot.scope).not.toBe(save.scope);
    expect(boot.correlationId).not.toBe(save.correlationId);
  });

  it("stamps the environment and release so an alert identifies what is broken", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");

    const report = reportError({ scope: "api", event: "unhandled", error: new Error("boom") });

    expect(report).toMatchObject({ environment: "production", release: "abc123" });
    vi.unstubAllEnvs();
  });

  it("emits one parseable JSON line per report", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    reportError({ scope: "api", event: "unhandled", error: new Error("boom") });

    const line = consoleError.mock.calls[0][0] as string;
    expect(() => JSON.parse(line)).not.toThrow();
    expect(JSON.parse(line)).toMatchObject({ level: "error", scope: "api", event: "unhandled" });
  });

  it("forwards to a configured sink and survives one that throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = vi.fn(() => {
      throw new Error("tracker unreachable");
    });
    setErrorSink(sink);

    // A failing error tracker must not become a second outage.
    expect(() => reportError({ scope: "api", event: "unhandled", error: new Error("boom") })).not.toThrow();
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("accepts a caller-supplied correlation id so one incident can be traced across reports", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const first = reportError({ scope: "api", event: "a", error: new Error("x"), correlationId: "corr-1" });
    const second = reportError({ scope: "progress-save", event: "b", error: new Error("y"), correlationId: "corr-1" });

    expect(first.correlationId).toBe("corr-1");
    expect(second.correlationId).toBe("corr-1");
  });
});
