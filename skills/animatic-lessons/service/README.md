# The lessons service

A small service for one Mac. Agents ask for lessons, a worker agent makes them, and a site shows the library and the queue, live.

```
any agent ── lessons request "…" ──▶  queue (SQLite)  ◀── lessons stage/log/attach/done ── worker agent
                                          │                                                    ▲
                                          ▼                                                    │
                              site  http://localhost:4747                    lessons work: pops a request,
                              courses · lessons · queue, live                starts `claude -p` on it
```

Node 22.5+ and nothing else: the queue is `node:sqlite`, the site is `node:http`. Making a lesson also needs `ffmpeg` and Claude Code (`claude`) on PATH.

## Install (macOS)

```
node <skill>/service/bin/lessons.mjs install
```

This starts two launchd agents that run at login and restart if they stop (`com.animatic-lessons.site`, `com.animatic-lessons.worker`), and links `lessons` into `~/.local/bin`. `lessons uninstall` removes both and keeps your data. `lessons doctor` says whether each thing the service needs is there and running.

Elsewhere, or by hand: `lessons serve` in one terminal, `lessons work` in another.

## Where things live

`lessons home` prints these. `LESSONS_HOME` and `LESSONS_LIBRARY` move them.

```
~/.animatic-lessons/
  lessons.db       the queue: requests, their lessons, every event
  library/<course>/  one folder per course, laid out by the skill's starter kit (references/KIT.md)
  config.json      optional: { "voiceFlags": [...], "agent": [...], "pollSeconds": 5, "maxMinutes": 60 }
  logs/            the site, the worker, and each request's raw agent stream
```

The library folders are the truth about courses and lessons; the database holds only the queue.

## Asking for a lesson

```
lessons request "How does Tailnet Lock work, and do I need it on a solo tailnet?"
```

Run from an agent's working folder, it also records the conversation the request came from: the folder's newest Claude Code transcript and its last user message (`--transcript <path>` and `--message <id>` say so exactly; `--transcript none` records neither). The worker reads around that message to learn what the person was doing and what they did not follow. `--course <slug>` suggests a course to extend. The `request-lesson` skill teaches other agents this command. The site's **Request a lesson** button queues one too, without a transcript.

## What the worker does

`lessons work` claims the oldest queued request and starts one headless agent on it with [`WORKER.md`](WORKER.md) as its prompt. The agent moves through eight stages, reporting each to the queue:

| stage | what happens |
|---|---|
| `context` | reads the transcript around the message |
| `course` | extends an existing course, or creates one |
| `research` | reads sources, writes `research.md` |
| `plan` | decides what to teach, and how many lessons (one to three) |
| `write` | storyboards and lesson pages |
| `learner` | a fresh subagent reads the lessons and the research, and critiques the content |
| `frames` | frames rendered without voice, read at full size, critiqued, fixed, repeated |
| `render` | the final videos, with voice and captions |

The agent's stream is copied into the queue as it arrives, so the site shows what it says and each tool it calls. One request runs at a time. A request still running after `maxMinutes` is stopped and marked failed. A request whose agent stops without closing it is marked failed; one a crashed worker held is retried once.

**Permissions.** The agent runs unattended, so it is started with `--permission-mode acceptEdits` and an allowlist that includes `Bash`, `WebFetch` and subagents. It can run any command as you. Change the command in `config.json` (`agent`) to narrow that.

**Voice.** `voiceFlags` in `config.json` go on every build, for example `["--engine", "kokoro"]` (see the engine's `VOICE.md`). With none, the engine uses the Mac's built-in voice.

## The site

- **Home** and **course** pages: lessons as cards, grouped by course, searchable.
- **Watch** page: the video with captions, the guess-first question, recall questions, sources, a transcript that follows the video and seeks on click, and the course's other lessons beside it.
- **Queue**: what is being made, what is waiting, what finished.
- **A request's page**: its stage, the agent's transcript as it happens, and each lesson's script, then frames, then video as they come into being.

It listens on `127.0.0.1` only. `lessons serve --host 0.0.0.0` opens it to your network; it has no sign-in.

## Tests

```
node --test skills/animatic-lessons/service/test/service.test.mjs
```
