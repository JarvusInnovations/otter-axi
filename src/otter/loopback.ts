import { createServer, type Server } from "node:http";
import { createServer as netServer } from "node:net";
import { AxiError } from "axi-sdk-js";

export interface Loopback {
  port: number;
  /** Resolves with the authorization code, or rejects on error / timeout. */
  waitForCode(timeoutMs: number): Promise<string>;
  close(): void;
}

/** Return the first port from `candidates` that is bindable on 127.0.0.1. */
export async function pickPort(candidates: number[]): Promise<number> {
  for (const port of candidates) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = netServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new AxiError(`No free loopback port among ${candidates.join(", ")}`, "AUTH", [
    "Close whatever is using those ports and retry `otter-axi auth login`",
  ]);
}

/**
 * Start a loopback HTTP server on `127.0.0.1:port` that captures the OAuth redirect at
 * `/callback`. The browser response is sent UTF-8 (so the em-dash renders correctly).
 */
export async function startLoopback(port: number): Promise<Loopback> {
  let resolveCode: (code: string) => void;
  let rejectCode: (err: unknown) => void;
  const codePromise = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });

  const server: Server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (u.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }
    const code = u.searchParams.get("code");
    const err = u.searchParams.get("error");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><html><head><meta charset="utf-8"><title>otter-axi</title></head>` +
        `<body style="font-family:system-ui;padding:2.5rem;color:#222">` +
        `<h2>otter-axi: ${code ? "authorized — you can close this tab" : `error: ${err ?? "unknown"}`}</h2>` +
        `</body></html>`,
    );
    if (code) resolveCode(code);
    else
      rejectCode(
        new AxiError(`Authorization was denied (${err ?? "unknown"})`, "AUTH", [
          "Run `otter-axi auth login` to try again",
        ]),
      );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    port,
    waitForCode(timeoutMs: number): Promise<string> {
      let timer: NodeJS.Timeout;
      const timeout = new Promise<string>((_, rej) => {
        timer = setTimeout(
          () =>
            rej(
              new AxiError("Timed out waiting for authorization", "AUTH", [
                "Run `otter-axi auth login` and approve promptly (codes are short-lived)",
              ]),
            ),
          timeoutMs,
        );
      });
      return Promise.race([codePromise, timeout]).finally(() => clearTimeout(timer));
    },
    close(): void {
      server.close();
    },
  };
}
