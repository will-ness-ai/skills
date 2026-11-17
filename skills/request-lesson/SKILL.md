---
name: request-lesson
description: Queue a short narrated video lesson on a topic, made in the background by the lessons service. Use when the person asks for a lesson, a video or a course on something, or asks to "queue a lesson".
---

The lessons service makes animatic lessons in the background: you queue a request, a worker agent researches the topic and builds one to three short videos, and the person watches them on a local site. Your part is the request.

Queue a lesson only when the person asks for one. If you think a lesson would help and they have not asked, offer it in one line and wait.

## 1. Find the command

Run `lessons help`. If the shell has no `lessons`, use `node ~/.claude/skills/animatic-lessons/service/bin/lessons.mjs` in its place (`~/.agents/skills/…` in a harness that keeps skills there).

If neither exists, the skills that hold the service are not installed. Tell the person, and point them to `/animatic-lessons`, which makes lessons in this session with no service.

## 2. Write the request

The worker starts with your request text and, when it can find it, this conversation. Write the text for an agent that knows nothing else:

- **What the person wants to understand or be able to do**, in their words.
- **What brought it up**: the task they were on, and the thing they did not follow.
- **What they already know**, so the lessons start in the right place.

Leave out how to teach it. The worker decides that.

## 3. Queue it

Run from the working folder of this session:

```
lessons request "<the request>"
```

From there the command records a transcript and the person's last message in it, and the worker reads around that message for context. It prints the transcript it chose on a `context:` line. In Claude Code that is this session; in another harness it is a guess at the folder's newest Claude Code session, so pass `--transcript none` unless you know it is this conversation.

Two more flags:

- `--course <slug>` when the lesson belongs in a course that exists. `lessons courses` lists them.
- `--transcript none` also when this conversation holds something the person would not want another agent to read.

Done when the command prints `queued request <id>` and a link. If it also prints `no worker is running`, the request will wait: say so in step 4, with the command it names.

## 4. Tell the person

Give them the link the command printed, where they can watch the lesson being made, and say it usually takes ten to twenty minutes. Then carry on with what you were doing. Do not wait for the lesson.

`lessons show <id>` reports its state later, if they ask.
