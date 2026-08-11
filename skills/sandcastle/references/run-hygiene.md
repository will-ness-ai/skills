# Run hygiene

How to read, kill, and clean up a Sandcastle run. The evidence rule everywhere: **logs and containers tell the truth; the process does not.**

## Liveness — is a run alive in this worktree?

Three probes, together:

- `pgrep -f "tsx .sandcastle/main.mts"` — an orchestrator process exists somewhere.
- `docker ps` — a sandbox container is actually working.
- `ls -t .sandcastle/logs/ | head -1` + its mtime — when the run last did anything.

A leftover inner worktree under `.sandcastle/worktrees/` proves nothing either way — runs have been misread as dead from worktree state alone, and a second launch over a live run ends with two agents claiming the same ticket and one orchestrator dying on the merge conflict. Probe before launching into any worktree that has a `.sandcastle/logs/` history.

## Zombies — the post-dry hang

An orchestrator can hang indefinitely *after* its final dry iteration (observed: nine hours) — the log shows the implementer signed off with no commits, no container remains, yet the process lives. The template's `process.exit(0)` at the end of main.mts retires this at the source; on an older harness, the diagnosis is: newest log idle + `docker ps` empty + batch exhausted ⇒ zombie.

Killing one is clean at that point — nothing is mid-flight by construction:

```
pkill -f "tsx .sandcastle/main.mts"
```

Caveat: that pattern also kills any watcher script whose command line embeds the same string (a `while pgrep …` monitor dies with it). Kill by PID when a watcher should survive.

## Killed mid-iteration

State is clean: the ticket was not yet marked done, the iteration branch is unmerged. Remove its sandbox worktree (`git worktree remove --force .sandcastle/worktrees/<name>`) and delete the branch.

## Orphan branches

`sandcastle/sequential-reviewer/<timestamp>` branches accumulate when post-merge deletion is blocked by a preserved worktree. Delete any that are fully contained in the lane branch (`git log <lane>..<branch>` prints nothing); keep the rest — they hold unmerged work from a killed iteration.

## Relaunch causes seen in practice

- Docker daemon not running, or network down mid-pull — relaunch once the dependency is back; the batch re-resolves and already-done tickets are skipped (they no longer match the run config's open set, or land no commits).
- Cold package-manager store makes the first install crawl — seed `.sandcastle/pnpm-store` from another worktree's store (`cp -Rc`) before launching.
- Tickets that add devDependencies leave the *host* worktree stale — run the host install again before gating, or host tests fail on missing modules.
