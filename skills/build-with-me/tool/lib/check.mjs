// Screenshot loop: render the page, shoot it at desktop and phone width in light and dark,
// open the review queue and the proof map, and report overflow and script errors.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { render } from "./render.mjs";
import { UserError } from "./store.mjs";

function playwright() {
  for (const from of [process.cwd() + "/", import.meta.url]) { try { return createRequire(from)("playwright"); } catch {} }
  throw new UserError("Playwright isn't installed here", ["npm i -D playwright && npx playwright install chromium", "Or skip the loop: bwm render, then open the file and look yourself."]);
}

export async function check(st, { tool, dir, url }) {
  const { chromium } = playwright();
  const out = path.join(dir, "shots"); fs.mkdirSync(out, { recursive: true });
  const target = url ?? "file://" + path.join(dir, "page.html");
  if (!url) render(st, path.join(tool, "page"), path.join(dir, "page.html"));
  const browser = await chromium.launch();
  const shots = [], faults = [];
  const views = [["desktop-light", 1440, 1000, "light"], ["desktop-dark", 1440, 1000, "dark"], ["phone", 390, 844, "light"]];
  try {
    for (const [name, width, height, scheme] of views) {
      const p = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
      p.on("pageerror", (e) => faults.push({ view: name, fault: `script error: ${e.message}` }));
      await p.goto(target); await p.waitForTimeout(500);
      const shoot = async (label) => {
        const file = path.join(out, `${label}.png`); await p.screenshot({ path: file, fullPage: true }); shots.push({ view: label, path: file });
        const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (over > 1) faults.push({ view: label, fault: `page scrolls sideways by ${over}px` });
      };
      await shoot(name);
      if (name !== "desktop-dark") {
        if (await p.$("[data-queue]")) { await p.click("[data-queue]"); await p.waitForTimeout(150); await shoot(`${name}-queue`); await p.click("[data-board]"); }
        const proof = await p.$('[data-open]:is(.kt)');
        const proofId = await p.evaluate(() => { const s = window.BWM_STATE; const c = s && s.cards.find((x) => x.kind === "proof" && x.status !== "check"); return c ? c.id : null; });
        if (proof && proofId) { await p.click(`[data-open="${proofId}"]`).catch(() => {}); await p.waitForTimeout(150); if (await p.$(".cov")) await shoot(`${name}-proofs`); }
      }
      await p.close();
    }
  } finally { await browser.close(); }
  return { shots, faults };
}
