import type { constants } from "node:os";

export type SignalName = keyof typeof constants.signals;
export type SignalSender = (pid: number, signal: SignalName) => void;

const sendWithProcessKill: SignalSender = (pid, signal) => {
  process.kill(pid, signal);
};

/** Signals every process in the group led by `leaderPid` (a child spawned
 *  with `detached: true`). Returns false when nothing was signalled.
 *
 *  The pid guard is a safety rule, not tidiness: `kill(-0)` signals OUR
 *  OWN group and `kill(-1)` every process we may signal, so an unset or
 *  non-positive pid must never reach `process.kill`. */
export function signalProcessGroup(leaderPid: number | undefined, signal: SignalName, send: SignalSender = sendWithProcessKill): boolean {
  if (leaderPid === undefined || !Number.isSafeInteger(leaderPid) || leaderPid <= 1) return false;
  try {
    send(-leaderPid, signal);
    return true;
  } catch {
    // ESRCH: the group is already gone, which is the outcome we wanted.
    return false;
  }
}
