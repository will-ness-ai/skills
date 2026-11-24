# Proof

A proof is a claim the human can check, backed by runs you captured while they happened. Write the
claim as the human would test it ("Your phone opens the site and a lesson plays"), not as the code
sees it ("GET / returns 200").

## Kinds

- **golden**: the main path works end to end, the way the human will use it.
- **edge**: unusual but valid input or state: empty, huge, slow, asleep, offline, first run, the
  hundredth run.
- **error**: what goes wrong is refused or reported cleanly: bad input, missing permission, a
  dependency down. Show the message the human or caller sees.
- **hardening**: what must stay impossible, stays impossible: reaching it from outside, a second
  submit, a replayed token, a dangerous default.

A goal is proven when every done-when line has golden proof and each kind has either proof or a
planned card (`bwm proof add --planned`) that says why it isn't needed yet.

## Evidence

Capture it while the run happens, and attach the real artifact:

- **Terminal**: tee the run into a file and attach it: `curl -sI <url> 2>&1 | tee /tmp/p1.txt`,
  then `--evidence /tmp/p1.txt`. Keep the prompt line, so the human sees what you ran.
- **Screens**: take a Playwright screenshot of the exact state the step claims, at the size the
  human uses (390 px wide for a phone). Use `deviceScaleFactor: 2` for anything the human will
  look at closely.
- **Motion**: record a short Playwright video (`recordVideo` on the context) when the claim is about
  something moving: playback, a transition, a live update. Cut it to the steps.
- **Tests**: a test run counts when its output names the behaviour. Attach the runner's output for
  the tests that prove this claim, not the whole suite.

## Controls

A control shows that the test can tell pass from fail. It's the same check run where the answer
should flip:

- the request without the login, next to the request with it
- the page before the fix, next to the page after it
- from outside the network, next to from inside it

Record it with `bwm proof control`. A proof with no control is one the human has to take on trust.

## When the human checks it

Hand a proof over with `pass --check` when the judgement is theirs: how something looks or feels,
behaviour on their own device or account, or wording they'll own. Everything a command can decide,
pass yourself.
