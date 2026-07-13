---
"mattpocock-skills": patch
---

Make loading `grilling` and `domain-modeling` an explicit first step of wayfinder's "Chart the map".

Sessions often invoked only `/grilling` and skipped `/domain-modeling`, losing the shared language the rest of the map-charting conversation depends on. Step 1 now instructs the agent to call the Skill tool for both — before the first question to the user — with every later step running under them.
