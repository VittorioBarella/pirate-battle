import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});

const page = await context.newPage();
const errors = [];

page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto("http://127.0.0.1:4173/?profile=1");

  // This browser context is isolated from your normal browser storage.
  await page.getByRole("button", {
    name: "Options",
    exact: true,
  }).click();

  await page.getByLabel("Session duration (seconds)").fill("180");
  await page.getByLabel("Enemy spawn interval (seconds)").fill("4");
  await page.getByRole("button", { name: "Save Options" }).click();

  async function start(buttonName) {
    await page.getByRole("button", {
      name: buttonName,
      exact: true,
    }).click();

    await page.getByTestId("game-canvas").waitFor({
      state: "visible",
      timeout: 15_000,
    });

    await page.waitForFunction(() => Boolean(window.__observeBattle));
    await page.bringToFront();

    const resume = page.getByRole("button", {
      name: "Resume",
      exact: true,
    });

    if (await resume.isVisible()) {
      await resume.click();
    }
  }

  const session = await context.newCDPSession(page);

  async function memorySample(label) {
    await session.send("HeapProfiler.collectGarbage");
    const heap = await session.send("Runtime.getHeapUsage");

    return {
      label,
      usedHeapBytes: heap.usedSize,
      canvasCount: await page.locator("canvas").count(),
    };
  }

  await start("Play");

  const initial = await page.evaluate(() => window.__observeBattle());

  if (initial.player.maxHp !== 10_000) {
    throw new Error("Expected the profiling build with 10,000 HP.");
  }

  if (await page.evaluate(() => Boolean(window.__battle))) {
    throw new Error("The controlled test bridge must be disabled.");
  }

  console.log("Profiling started. Keep the automated browser in front.");

  const keys = ["KeyW", "KeyD", "Space", "KeyQ", "KeyE"];

  for (const key of keys) {
    await page.keyboard.down(key);
  }

  const startedAt = Date.now();
  let lastProgress = -1;

  while (
    !(await page.getByRole("heading", {
      name: "Battle complete",
      exact: true,
    }).isVisible())
  ) {
    if (Date.now() - startedAt > 300_000) {
      throw new Error(
        "The profiling match did not finish within five minutes.",
      );
    }

    const resume = page.getByRole("button", {
      name: "Resume",
      exact: true,
    });

    if (await resume.isVisible()) {
      throw new Error(
        "Profiling interrupted by focus loss. Run it again.",
      );
    }

    const state = await page.evaluate(() => window.__observeBattle?.());

    if (state) {
      const progress = Math.floor(state.elapsed / 30);

      if (progress > lastProgress) {
        console.log(`Active game time: ${state.elapsed.toFixed(1)}s`);
        lastProgress = progress;
      }
    }

    await page.waitForTimeout(1_000);
  }

  // Capture the match duration before memory sampling and restart cycles.
  const matchWallDurationSeconds = (Date.now() - startedAt) / 1000;

  for (const key of keys) {
    await page.keyboard.up(key);
  }

  const measurement = await page.evaluate(() => ({
    frames: [...window.__performance.frames],
    entities: [...window.__performance.entities],
    result: JSON.parse(localStorage.getItem("pb:last") ?? "null"),
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
  }));

  if (
    measurement.result?.reason !== "time" ||
    measurement.result?.duration !== 180
  ) {
    throw new Error("Expected a completed 180-second match.");
  }

  const frames = measurement.frames.filter(
    (value) => Number.isFinite(value) && value > 0,
  );

  if (frames.length === 0) {
    throw new Error("No frame samples recorded.");
  }

  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  const mean = frames.reduce((sum, value) => sum + value, 0) / frames.length;

  await page.getByRole("button", {
    name: "Main Menu",
    exact: true,
  }).click();

  const memory = [await memorySample("after full match")];

  for (let cycle = 1; cycle <= 5; cycle++) {
    await start("Play");

    await page.keyboard.down("Space");
    await page.waitForTimeout(3_000);
    await page.keyboard.up("Space");

    await page.getByRole("button", {
      name: "Pause",
      exact: true,
    }).click();

    await page.getByRole("button", {
      name: "Abandon · Main Menu",
      exact: true,
    }).click();

    await page.getByTestId("game-canvas").waitFor({
      state: "detached",
    });

    memory.push(await memorySample(`after restart ${cycle}`));
    console.log(`Memory cycle ${cycle}/5 completed.`);
  }

  const report = {
    recordedAt: new Date().toISOString(),
    environment: {
      platform: os.platform(),
      architecture: os.arch(),
      cpu: os.cpus()[0]?.model,
      logicalCpuCount: os.cpus().length,
      systemMemoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
      browser: browser.version(),
      viewport: { width: 1280, height: 900 },
      devicePixelRatio: measurement.devicePixelRatio,
      userAgent: measurement.userAgent,
    },
    match: measurement.result,
    performance: {
      targetFps: 60,
      sampledFrames: frames.length,
      averageFps: Number((1000 / mean).toFixed(2)),
      frameIntervalP95Ms: Number(p95.toFixed(2)),
      maxEntities: Math.max(...measurement.entities),
      wallDurationSeconds: Number(matchWallDurationSeconds.toFixed(2)),
    },
    memory,
    pageErrors: errors,
    limitations: [
      "Profiling configuration uses 10,000 HP instead of the normal 100 HP.",
      "Keyboard input holds movement, rotation and all weapons.",
      "Frame samples measure ticker intervals, not GPU execution time.",
      "Only the latest 20,000 frame and entity samples are retained.",
      "Wall duration is measured from input setup to completion detection, with approximately one-second polling precision.",
      "Heap samples cover JavaScript memory, not total browser or GPU memory.",
      "Shared textures and bounded frame metrics remain cached.",
      "Five short restart cycles cannot prove the absence of all memory leaks.",
    ],
  };

  await mkdir("reports", { recursive: true });
  await writeFile(
    "reports/profile-stress.json",
    JSON.stringify(report, null, 2) + "\n",
  );

  console.log(JSON.stringify(report.performance, null, 2));
  console.log("Report saved: reports/profile-stress.json");
} finally {
  await browser.close();
}