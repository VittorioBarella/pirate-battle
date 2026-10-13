import { http, HttpResponse, delay } from "msw";
import type { Match, Page } from "../api/contracts";
import { read, write } from "../api/storage";
import { configKey, defaultOptions, makeConfig } from "../config/gameConfig";
export const scenarios = [
  "success",
  "empty",
  "slow",
  "variable",
  "timeout",
  "offline",
  "http-400",
  "http-500",
  "ranking-error",
  "history-error",
  "commit-timeout",
  "unavailable",
] as const;
export type Scenario = (typeof scenarios)[number];
const fixtures: Match[] = Array.from({ length: 24 }, (_, i) => ({
  id: `fixture-${i}`,
  playerId: `pirate-${i}`,
  playerName: [
    "Anne Bonny",
    "Blackbeard",
    "Calico Jack",
    "Mary Read",
    "Sea Wolf",
    "Iron Sail",
  ][i % 6],
  date: new Date(Date.UTC(2026, 0, 1, 12, i)).toISOString(),
  score: 24 - i,
  duration: 120,
  reason: "time",
  config: makeConfig(defaultOptions),
}));
let sequence = 0;
export const setScenario = (value: Scenario) => {
  write("scenario", value);
  sequence = 0;
};
export const getScenario = () => read<Scenario>("scenario", "success");
export function resetMock() {
  write("confirmed", []);
  write("pending", []);
  write("last", null);
  setScenario("success");
}
async function condition(resource: string) {
  const s = getScenario();
  const n = ++sequence;
  await delay(
    s === "slow" ? 1200 : s === "variable" ? (n % 2 === 1 ? 1100 : 80) : 80,
  );
  if (s === "offline") return HttpResponse.error();
  if (s === "timeout") {
    await delay(2600);
    return HttpResponse.json({ message: "Timed out" }, { status: 504 });
  }
  if (s === "http-400")
    return HttpResponse.json(
      { message: "Simulated bad request" },
      { status: 400 },
    );
  if (s === "http-500" || s === "unavailable" || s === `${resource}-error`)
    return HttpResponse.json(
      { message: "Simulated service unavailable" },
      { status: 503 },
    );
  return null;
}
export const handlers = [
  http.get("/api/:resource", async ({ request, params }) => {
    const resource = String(params.resource);
    if (!["ranking", "history"].includes(resource))
      return HttpResponse.json({}, { status: 404 });
    const error = await condition(resource);
    if (error) return error;
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const key = url.searchParams.get("config");
    const confirmed = read<Match[]>("confirmed", []);
    const items =
      getScenario() === "empty"
        ? []
        : resource === "ranking"
          ? [...fixtures, ...confirmed].filter(
              (m) => configKey(m.config) === key,
            )
          : confirmed.filter(
              (m) => m.playerId === url.searchParams.get("playerId"),
            );
    items.sort(
      resource === "ranking"
        ? (a, b) =>
            b.score - a.score ||
            a.duration - b.duration ||
            a.date.localeCompare(b.date) ||
            a.id.localeCompare(b.id)
        : (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
    );
    const data: Page = {
      items: items.slice((page - 1) * 5, page * 5),
      total: items.length,
      page,
      pageSize: 5,
    };
    return HttpResponse.json(data);
  }),
  http.post("/api/matches", async ({ request }) => {
    const match = (await request.json()) as Match;
    if (
      !match.id ||
      !match.config ||
      !Number.isFinite(match.score) ||
      !["time", "death"].includes(match.reason)
    )
      return HttpResponse.json({ message: "Invalid match" }, { status: 400 });
    const existing = read<Match[]>("confirmed", []).find(
      (m) => m.id === match.id,
    );
    // A retry after an ambiguous timeout recovers the exact existing record.
    if (existing) return HttpResponse.json(existing);
    const error = await condition("register");
    if (error) return error;
    const records = read<Match[]>("confirmed", []);
    if (!records.some((m) => m.id === match.id)) {
      write("confirmed", [...records, match]);
    }
    if (getScenario() === "commit-timeout") await delay(2600);
    return HttpResponse.json(match, { status: 201 });
  }),
];
