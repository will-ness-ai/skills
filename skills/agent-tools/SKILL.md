---
name: agent-tools
description: Build commands for agents in AXI style. Use when writing or changing a script or CLI whose reader is an agent, or when an agent runs a chain or loop of tool calls toward one answer.
---

# Agent tools

An **agent tool** is a command whose reader is an agent, not a person. Its cost is **turns**
(every call is another round trip through the model) and **tokens** (every line it prints stays
in the window; count them as output bytes, `wc -c`). Its job is to collapse a **chain**: the run of tool calls an agent makes toward
one answer, where each call's **intermediate result** passes through the window only to pick the
next call. A loop is a chain whose links repeat (poll, check, sleep, poll); a **one-way chain**
doesn't (read a config, query a service, filter the answer, open a file). The tool runs the chain itself
and prints the **minimally relevant context**: what the agent would have gone on to use, and
nothing else.

Two pieces of Anthropic's research name this. [Writing effective tools for
agents](https://www.anthropic.com/engineering/writing-tools-for-agents) builds one tool for
"frequently chained, multi-step tasks" (`schedule_event` over list-then-create, `search_logs`
over `read_logs`) and tracks tool calls to reveal the workflows agents keep chaining. [Code
execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) keeps
intermediate results out of the window by running the chain in code, so the agent sees "five
rows instead of 10,000". A chain that recurs across sessions earns a tool built here; a one-off
chain is still one call when the agent writes a short script that runs it and prints only the
answer, and that script, written a second time, is a tool waiting to be built.

The style is AXI ([axi.md](https://axi.md); the upstream spec is
[kunchenguid/axi's skill](https://raw.githubusercontent.com/kunchenguid/axi/main/.agents/skills/axi/SKILL.md)),
adapted below. When the repo already has agent tools (an `axi` or `qa` script, a file that opens
by naming this skill), read the closest one before starting. The rules below are the contract:
follow them in a new tool, and bring an old one in line in the part you touch.

## Steps

1. **Name the chain.** Write down the calls an agent makes today to answer the question
   the tool is for (from the session or retro that asked for it): each command, what it printed,
   what the agent kept of it. Done when you can say which of those calls the tool replaces, and
   the turns and output bytes (`wc -c`) before and after.
2. **Shape the commands.** One entry point with subcommands, run the way the package runs
   scripts (`pnpm --silent <name>` in a Node package, `python tools/<name>.py` in Python). Write
   each command's `--help` first, from the rules below. Done when each chain from step 1 is one
   command that runs its links inside, and the bare run's output is sketched.
3. **Build it** to the rules below, with tests for its parsing and row formatting. Done when every rule is met or its absence is
   a deliberate choice you can name, and the tests pass.
4. **Run it as the agent will.** In a fresh shell: the bare run, each command's happy path, an
   empty result, a misspelt flag, a missing argument and a dependency failure (network down,
   process not running). Done when each output alone tells the agent its next step, nothing
   leaks a stack trace, and the chain from step 1 takes the turns and bytes you promised while
   its output still holds every fact step 1 marked as kept.
5. **Point at it.** Add one line where agents working in that area already look (the package's
   `AGENTS.md`, the `docs/` page, the skill that drives the work), naming the command and when to
   run it; its `--help` carries the rest. Invoke the Skill tool for `writing-for-agents`, and word
   that line by it. Done when an agent starting cold on that area's work would reach the line
   before building its own chain.

## Rules

**Output**

- **Rows, not prose.** Lists print as a [TOON](https://toonformat.dev/)-shaped header and rows:
  `matches[3]{id,state,players}:` then one comma-separated line each, quoting any value that
  holds a comma, a colon or a quote. Detail views print `key: value` lines. Plain text, no
  colour, no space-padded tables.
- **Few fields, enough rows.** A list row carries what lets the agent pick the next call: a
  name and a state it reasons with, and an id only where a next command takes one. Everything
  else waits for the detail view or `--full`. Default limits cover the common case in one call.
- **Intermediate results stay inside.** Each lookup, filter and join happens in the tool and
  stays out of stdout; a result the agent may need later goes to a file, and its path prints.
- **Cut long text with its size.** A long value prints its first 500-1500 characters and
  `… (truncated, 8432 chars total; use --full)`. Images and other files are written to disk and
  printed as paths for the agent to read.
- **Answer the next question too.** Include the totals and summaries the agent would otherwise
  fetch next: `count: 30 of 847`, `checks: 3/3 passed`, `errors: 2`. Only what is cheap to
  compute.
- **Say nothing found.** An empty result is a line that says so, with its scope:
  `faults: none on 14 pages at 4 sizes`.
- **Only what is wrong.** A check prints its failures and a one-line pass summary, never every
  passing case.

**Flow**

- **Home view.** Run bare, the tool prints live state (what is running, what is set up, what
  needs doing), then its commands. A usage page is for when there is no state to show.
- **Next steps.** End list, mutation and error output with a `help[N]:` block of complete
  commands that follow from it, carrying the flags in use and `<id>`-style placeholders for
  values the agent must fill. Offer a few directions, not a fixed sequence. A detail view that
  fully answers leaves it out.
- **Waits are commands.** When the agent would otherwise poll (a log line, a message, a window),
  give it a `wait <pattern>` that returns when it matches and says so when it times out.
- **Mutations repeat safely.** Asking for a state that already holds succeeds with `(no-op)`.

**Errors and channels**

- **stdout is for the agent.** Data, errors and next steps all go to stdout, in the same shape;
  progress and debug go to stderr. Exit 0 for success and no-ops, 1 for a failure, 2 for a usage
  error (an unknown command or flag, a missing argument).
- **Errors say the fix.** `error: no test server yet` then the `help[1]:` command that starts
  one. Translate a dependency's error into the tool's own terms and commands.
- **Reject what you don't know.** An unknown command or flag is a usage error naming it and
  listing that command's flags, checked before anything runs. A renamed flag names its
  replacement.
- **Flags only.** Every input comes from arguments; a missing one fails at once with the flag
  it needs. Nothing waits on stdin.

**Help**

- `<command> --help` prints that command's flags with defaults and two or three examples, and
  nothing about the other commands.
- The file opens with a comment saying it is for agents and follows the `agent-tools` skill,
  so a later editor keeps the contract. The rules live here, not restated per tool.

**Left out of AXI.** A tool that runs from a checkout, not a global install, skips AXI's session
hooks, installable skill, `bin:` line and `--version` fast path; step 5's pointer does the hooks'
job. A tool whose state every session in an area needs could earn a `SessionStart` hook in
`.claude/settings.json`; ask the user before adding one, since it loads on every session.
