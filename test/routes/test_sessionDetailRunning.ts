// #3294. The session detail response tells a catch-up whether the snapshot was
// taken mid-run: while a run is in progress the text being streamed is not in
// the file yet, so the client must not adopt it. The flag rides on the
// `session_meta` row, which is now always present.

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { Request, Response } from "express";

type RouteModule = typeof import("../../server/api/routes/sessions.js");
type SessionStore = typeof import("../../server/events/session-store/index.js");
type Handler = (req: Request, res: Response) => Promise<void> | void;
interface RouterInternals {
  stack: { route?: { path: string; stack: { method: string; handle: Handler }[] } }[];
}

let tmpRoot: string;
let chatDir: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
let detailHandler: Handler;
let store: SessionStore;

function extractRouteHandler(mod: RouteModule, routePath: string, method: string): Handler {
  const router = mod.default as unknown as RouterInternals;
  const layer = router.stack.find((frame) => frame.route?.path === routePath)?.route?.stack.find((stackLayer) => stackLayer.method === method);
  if (!layer) throw new Error(`route ${method.toUpperCase()} ${routePath} not registered`);
  return layer.handle;
}

async function fetchDetail(sessionId: string): Promise<unknown[]> {
  let body: unknown[] = [];
  const res = {
    status() {
      return res;
    },
    json(payload: unknown[]) {
      body = payload;
      return res;
    },
  };
  await detailHandler({ params: { id: sessionId } } as unknown as Request, res as unknown as Response);
  return body;
}

async function writeSession(sessionId: string, withMeta: boolean): Promise<void> {
  if (withMeta) await writeFile(path.join(chatDir, `${sessionId}.json`), JSON.stringify({ roleId: "general", startedAt: new Date().toISOString() }));
  await writeFile(path.join(chatDir, `${sessionId}.jsonl`), `${JSON.stringify({ source: "user", type: "text", message: "hi" })}\n`);
}

function startRun(sessionId: string): void {
  const now = new Date().toISOString();
  store.getOrCreateSession(sessionId, { roleId: "general", resultsFilePath: path.join(tmpRoot, "results.jsonl"), startedAt: now, updatedAt: now });
  assert.equal(
    store.beginRun(sessionId, () => {}),
    true,
  );
}

before(async () => {
  tmpRoot = await mkdtemp(path.join(tmpdir(), "mulmo-session-detail-running-"));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = tmpRoot;
  process.env.USERPROFILE = tmpRoot;
  const { WORKSPACE_PATHS } = await import("../../server/workspace/paths.js");
  chatDir = WORKSPACE_PATHS.chat;
  mkdirSync(chatDir, { recursive: true });
  store = await import("../../server/events/session-store/index.js");
  store.initSessionStore({ publish() {}, subscribe: () => () => {} } as unknown as Parameters<SessionStore["initSessionStore"]>[0]);
  detailHandler = extractRouteHandler(await import("../../server/api/routes/sessions.js"), "/api/sessions/:id", "get");
});

beforeEach(() => {
  store.__resetForTests();
  store.initSessionStore({ publish() {}, subscribe: () => () => {} } as unknown as Parameters<SessionStore["initSessionStore"]>[0]);
});

after(async () => {
  // initSessionStore starts an eviction interval that would keep the process alive.
  store.__resetForTests();
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("GET /api/sessions/:id — isRunning on the snapshot", () => {
  it("reports a run in progress", async () => {
    await writeSession("running-1", true);
    startRun("running-1");
    const [meta] = await fetchDetail("running-1");
    assert.deepEqual(
      { type: (meta as { type: string }).type, isRunning: (meta as { isRunning: boolean }).isRunning },
      { type: "session_meta", isRunning: true },
    );
  });

  it("reports no run once it has ended", async () => {
    await writeSession("ended-1", true);
    startRun("ended-1");
    store.endRun("ended-1");
    const [meta] = await fetchDetail("ended-1");
    assert.equal((meta as { isRunning: boolean }).isRunning, false);
  });

  it("reports no run for a session the store has never seen", async () => {
    await writeSession("cold-1", true);
    const [meta, first] = await fetchDetail("cold-1");
    assert.equal((meta as { isRunning: boolean }).isRunning, false);
    assert.deepEqual(first, { source: "user", type: "text", message: "hi" });
  });

  it("still carries the flag when the session has no meta file", async () => {
    await writeSession("no-meta-1", false);
    startRun("no-meta-1");
    const [meta, first] = await fetchDetail("no-meta-1");
    assert.deepEqual(meta, { type: "session_meta", isRunning: true });
    assert.deepEqual(first, { source: "user", type: "text", message: "hi" });
  });
});
