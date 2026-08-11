# Automation patterns

Traps that only show up when a script drives cmux in a loop. Each one below cost
someone a debugging session.

## Settle after every mutation

A cmux mutation returns before the app model shows the result. Live state settles
in about 20 ms, but it is not synchronous. A script that mutates and then reads
immediately gets the old value.

Poll until the new state reads back:

```bash
# Wait for a workspace with a known description to exist.
for i in $(seq 1 100); do
  ID=$(cmux rpc workspace.list | jq -r '.workspaces[] | select(.description=="owner/repo#1") | .id')
  [ -n "$ID" ] && break
  sleep 0.05
done
[ -z "$ID" ] && { echo "settle timeout" >&2; exit 1; }
```

50 ms poll, 5-second timeout works for every mutation here. Settle after
`new-workspace`, after `new-surface`, and after a `tab.action rename`.

## Identify what you just created

`cmux new-surface` prints its handles:

```
OK surface:98 pane:25 workspace:21
```

Parse that line when you can. When you cannot, take `surface.list` before and
after, then use the set difference:

```bash
BEFORE=$(cmux rpc surface.list "{\"workspace_id\":\"$WS\"}" | jq -r '.surfaces[].id' | sort)
cmux new-surface --type browser --url "$URL" --workspace "$WS" --focus false
AFTER=$(cmux rpc surface.list "{\"workspace_id\":\"$WS\"}" | jq -r '.surfaces[].id' | sort)
NEW=$(comm -13 <(echo "$BEFORE") <(echo "$AFTER"))
```

`surface.create` over rpc returns two different shapes across versions. Read
`.surface_id` and fall back to `.surface.id`.

## Identity: use description, not title

Titles drift. The user renames a workspace, an agent TUI rewrites a tab title,
and your matcher breaks. Set `--description` at creation and match on that.
Treat the title as display only, and rewrite it whenever it disagrees.

A workspace with a `null` description was not created by your script. That is how
you tell your own workspaces from the user's, and from group anchors.

## Surfaces do not carry a URL

`surface.list` returns `id`, `ref`, `index`, `index_in_pane`, `pane_id`,
`pane_ref`, `title`, `type`, `focused`, `selected_in_pane`, and
`developer_tools_visible`. There is no `url` field.

So a browser surface can only be matched by `type == "browser"` plus its title.
Give each browser tab a title you control, and enforce it with
`cmux rpc tab.action '{"action":"rename","surface_id":"...","title":"..."}'`.

Reading a browser surface needs the browser commands. `surface.read_text` fails
on one with `invalid_params: Surface is not a terminal`:

```bash
cmux browser --surface surface:215 get title
cmux browser --surface surface:215 get url
cmux browser --surface surface:215 get text --selector "#status"
```

## Two owners fight over a tab title

An enforced `tab.action rename` and the page's own `document.title` write the
same field, so they overwrite each other on every reload. Pick one owner. If your
script renames the tab, give the generated page a static `<title>` that it never
mutates.

## The webview does not watch files

A `file://` browser surface never reloads itself when the file changes. Atomic
`mv` does not help, and neither does rewriting in place. The tab stays stale
until you reload it:

```bash
cmux rpc browser.reload '{"surface_id":"<uuid>"}'
```

The reload acks in about 20 ms and the new content paints within a second. For a
page you generate, also bake in `setInterval(() => location.reload(), 5000)` so
it recovers on its own.

## Write the file before you open the tab

A browser tab created before its file exists shows the raw URL as its title, and
keeps it. Create directories, write the file, then create the tab.
`new-surface` and `browser.navigate` do not create directories.

## Workspace groups create themselves wrong

`cmux rpc workspace.group.create` ignores the name you pass, names itself, spawns
a stray anchor workspace, and pulls in whatever workspace is selected. Recover in
three steps:

1. Record every workspace id **before** the call.
2. Create the group, then `workspace.group.remove` each member that already
   existed.
3. `workspace.group.rename` to the name you wanted, then settle on it.

The stray anchor stays. Find it later by `group.anchor_workspace_id`, or by its
`null` description.

## Closing moves the user's selection

Closing a workspace can move the user off what they were looking at, because it
may close the workspace they are sitting in. Keep destructive passes behind an
explicit flag, and never run one as a side effect of a sync.

Leave a surface alone while it holds a live session. Yanking a tab out from under
a running agent loses its work.
