import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signalProcessGroup, type SignalName, type SignalSender } from "../../server/agent/processGroup.js";

function recordingSender(): { send: SignalSender; calls: [number, SignalName][] } {
  const calls: [number, SignalName][] = [];
  return { send: (pid, signal) => calls.push([pid, signal]), calls };
}

describe("signalProcessGroup", () => {
  it("signals the negated pid, i.e. the whole group", () => {
    const { send, calls } = recordingSender();
    assert.equal(signalProcessGroup(4321, "SIGTERM", send), true);
    assert.deepEqual(calls, [[-4321, "SIGTERM"]]);
  });

  it("passes the requested signal through", () => {
    const { send, calls } = recordingSender();
    signalProcessGroup(4321, "SIGKILL", send);
    assert.deepEqual(calls, [[-4321, "SIGKILL"]]);
  });

  // kill(-0) hits our own group and kill(-1) every process we may signal.
  for (const pid of [undefined, 0, 1, -1, -4321, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2]) {
    it(`never signals for pid ${String(pid)}`, () => {
      const { send, calls } = recordingSender();
      assert.equal(signalProcessGroup(pid, "SIGTERM", send), false);
      assert.deepEqual(calls, []);
    });
  }

  it("returns false instead of throwing when the group is already gone", () => {
    const gone: SignalSender = () => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
    };
    assert.equal(signalProcessGroup(4321, "SIGTERM", gone), false);
  });

  it("returns false instead of throwing on any other kill error", () => {
    const denied: SignalSender = () => {
      throw Object.assign(new Error("kill EPERM"), { code: "EPERM" });
    };
    assert.equal(signalProcessGroup(4321, "SIGTERM", denied), false);
  });
});
