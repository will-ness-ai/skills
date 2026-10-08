# Deslop examples

Each case is a before and an after. Lines marked _reported_ are quoted from public complaints about agent-written code; the rest show the same pattern in a minimal form.

## Comments

### Narration

```ts
// before (reported)
// Parse the hours
const hours = parseInt(raw, 10);
// Convert to seconds
const seconds = hours * 3600;

// after
const hours = parseInt(raw, 10);
const seconds = hours * 3600;
```

### Editorial, kept as a constraint

The fact stays. The argument for it goes.

```ts
// before (reported)
// Ollama answers empty text with 200 and no vector, which would read as a model fault.

// after
// Ollama returns 200 with no vector for empty input.
```

### Aphorism

```ts
// before (reported)
// Asked, never assumed — no path may fall back to the column default.

// after
// Callers must pass this; do not use the column default.
```

### History

The reason moves to the commit message, if it is worth keeping at all.

```python
# before
# Phase 2 (per review on ABC-123): removed the old retry loop, now uses backoff
delay = backoff(attempt)

# after
delay = backoff(attempt)
```

### Session leak

```go
// before
// Updated to use the new config loader as requested. This now correctly
// handles the case where the file is missing, which was the root cause
// of the earlier failure.
cfg, err := config.Load(path)

// after
cfg, err := config.Load(path)
```

### Comment longer than the code

```python
# before
# We deliberately clamp the value here rather than raising, because callers
# upstream treat a ValueError as a fatal configuration problem, and a
# slightly out-of-range ratio is common when users drag the slider quickly.
# Clamping keeps the UI responsive while still guaranteeing a valid ratio.
ratio = min(max(ratio, 0.0), 1.0)

# after
# Slider drags can overshoot; clamp instead of raising.
ratio = min(max(ratio, 0.0), 1.0)
```

### Duplicated in docstring and inline

```python
# before
def retry(fn, attempts=3):
    """Retry fn up to `attempts` times with exponential backoff."""
    # Retry the function up to `attempts` times, backing off exponentially.
    for i in range(attempts):
        ...

# after
def retry(fn, attempts=3):
    """Retry fn up to `attempts` times with exponential backoff."""
    for i in range(attempts):
        ...
```

## Dead code

### Empty scaffolding

```rust
// before (reported: 5 of 7 new modules were like this)
pub trait MortalityPolicy {}
pub const MARKER: &'static str = "scaffold: mortality";

// after: deleted. Nothing implements the trait or reads the constant.
```

### One-use wrapper

Propose this one; do not apply it. The wrapper is reached, so removing it changes call sites.

```ts
// before
function getUserById(id: string) { return fetchUser(id); }
const user = await getUserById(id);

// proposed in the report
const user = await fetchUser(id);
```

### Stub left as finished work

Report it first. Do not delete it.

```python
def reconcile(ledger):
    # TODO: implement real reconciliation
    return {"status": "ok", "mismatches": 0}
```

### Debug output and commented-out code

```js
// before
console.log("DEBUG payload", payload);
// const legacy = transform(payload);
send(payload);

// after
send(payload);
```

## Commit and PR text

### Commit message for a three-line diff

```text
before (reported shape: "a slop article for every one line commit"):
  fix: Comprehensive robustness improvements to upload handling

  ## Summary
  This commit introduces a belt-and-suspenders approach to upload
  reliability, ensuring seamless recovery from transient failures.

  ## Changes
  - ✅ Added retry logic to upload.ts
  - ✅ Added backoff helper
  - ✅ All tests pass

after:
  Retry uploads on 503 with exponential backoff
```

### Body only when the reason is not in the diff

```text
Pin pg to 8.11

8.12 changes how numeric columns are parsed and breaks the invoice totals.
Unpin once the upstream parsing fix ships.
```

### PR description

```text
before:
  ## 🚀 Summary
  This PR comprehensively refactors the upload pipeline ...
  ## 📁 Files changed
  - src/upload.ts: added retry
  - src/backoff.ts: new helper
  - test/upload.test.ts: new tests
  ## ✅ Testing
  All 214 tests pass.

after:
  Before: an upload that hits a 503 fails at once and the user has to retry by hand.

  After: the client retries up to three times with exponential backoff before it reports the failure.
```
