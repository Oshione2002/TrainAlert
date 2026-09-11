import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the finished TrainAlert shell", async () => {
  const [layout, app, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/train-alert-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /TrainAlert NG — Catch the seat/);
  assert.match(app, /Checking the tracks/);
  assert.match(app, /Book now on NRC/);
  assert.doesNotMatch(`${layout}\n${app}\n${packageJson}`, /codex-preview|react-loading-skeleton|Starter Project/i);
});

test("service worker provides the two requested actions", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /action: "book", title: "Book now"/);
  assert.match(source, /action: "end", title: "End alert"/);
  assert.doesNotMatch(source, /notificationclose/);
});
