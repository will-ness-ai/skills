# Screenshot critique: lesson 9

Every frame opened at full size from `build/NN.png` and read against its line.

## Pass 1 (first clean build): 9 frames, 5 findings

| # | Frame | Finding |
|---|---|---|
| 1 | title card | ok. The question itself is the headline. |
| 2 | map, laptop-to-website arrow lit | ok. Arrow meets both boxes, label clear. Minor: the website sits on a map titled "Your tailnet" with nothing but its sub-label to say it is outside. Left as is: the sub-label says "public internet". |
| 3 | map, dev box "exit node" lit | ok. |
| 4 | map, route through the dev box lit | ok, the strongest frame: the old arrow is gone and the new two-leg path is the one lit thing. |
| 5 | terminal, advertise command | **Dead space** (two lines in the frame) and **dim text too dim**: the "# 1. on the dev box:" label that says which machine this is on is the faintest thing on screen. Fix: larger terminal type; step labels in a readable tone. |
| 6 | terminal, admin-console step lit | **The lit line is dimmer than the unlit command above it** (it is a faint comment). The one thing the frame lights must be the brightest thing on it. Also a weak picture: an admin-console click shown as a shell comment. Kept in the terminal so the three steps stay on one frame, but fixed the tone. |
| 7 | terminal, `--exit-node=<ip|name>` lit | ok apart from dead space. Placeholder is the CLI reference's own form, said so on the page. |
| 8 | terminal, `--exit-node=` lit | ok apart from dead space. |
| 9 | Remember card | **Wording.** "all your web traffic": the docs say public internet traffic, not just web. Fix the headline. |

Fixed after pass 1: 5-8 (terminal type, step label tone), 6 (lit line tone), 9 (headline).

## Pass 2 (after fixes): changed frames 2-9 re-read, 1 finding

| # | Frame | Finding |
|---|---|---|
| 2-4 | map | ok. Muted boxes more readable after the component change. |
| 5, 7, 8 | terminal at 40px | ok. Step labels ("# 1. on the dev box:") are now blue and readable. |
| 6 | terminal, admin-console step lit | ok. The lit line is now the brightest thing on the frame. **Kit flaw:** the lit-line bar overlaps the "#". Fixed in `assets/frames.css`. |
| 9 | Remember card | ok. "carries your internet traffic" matches the docs. |

Fixed after pass 2: 6 (bar).

## Pass 3 (after fixes): frames 4, 6 re-read, 0 findings

Nothing worth fixing.

Left as is: step 2 is a click in the admin console shown as a comment in a terminal. A screenshot of the console would be the better picture; none was available to capture, and a mock-up would break "real content only".

## After the learner review (see `../../learner-review.md`): rebuilt, one screenshot pass on changed frames (1-10), 0 findings

| # | Frame | Finding |
|---|---|---|
| 1 | title card | ok. New question: the allowlist that accepts only your home IP. |
| 2 | map, crossed arrow "from the café's IP" to "staging admin" | ok. The refusal is the lit thing; label clear of the line. |
| 4 | map, "encrypted" then "as your home IP" | ok. Both legs labelled; the vertical leg's label sits beside it without touching the box. |
| 5-6 | terminal, `dev-box` | ok. The approval line names the page (Machines). Still a console click shown as a comment. |
| 7-10 | terminal, "your laptop, on café Wi-Fi" | ok. Before and after addresses, then the LAN-access line (72 characters, fits at 36px with 100px to spare), then the stop command. |
