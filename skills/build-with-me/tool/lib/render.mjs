// One self-contained HTML file: page, styles, script, state and evidence inlined.
import fs from "node:fs";
import path from "node:path";
import { withEvidence, INLINE_LIMIT } from "./evidence.mjs";

export function render(st, page, file) {
  const skipped = [];
  const state = withEvidence(st.state(), (step, mime) => {
    const size = fs.statSync(step.evidence).size;
    if (size > INLINE_LIMIT) { skipped.push(step.evidence); return "file://" + step.evidence; }
    return `data:${mime};base64,${fs.readFileSync(step.evidence).toString("base64")}`;
  });
  const css = fs.readFileSync(path.join(page, "style.css"), "utf8"), js = fs.readFileSync(path.join(page, "app.js"), "utf8");
  const json = JSON.stringify(state).replace(/</g, "\\u003c");
  const html = fs.readFileSync(path.join(page, "index.html"), "utf8")
    .replace(`<link rel="stylesheet" href="style.css">`, () => `<style>\n${css}</style>`)
    .replace(`<script>/*STATE*/</script>`, () => `<script>window.BWM_STATE = ${json};</script>`)
    .replace(`<script src="app.js"></script>`, () => `<script>\n${js.replace(/<\/script/gi, "<\\/script")}</script>`)
    .replace("<title>Build With Me</title>", () => `<title>${state.goal.title.replace(/[<&]/g, "")}</title>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return { bytes: Buffer.byteLength(html), skipped };
}
