import axios from "axios";
import type { Match, Page } from "./contracts";
export const api = axios.create({ baseURL: "/api", timeout: 1800 });
export const fetchPage = async (
  resource: string,
  page: number,
  config: string,
  signal?: AbortSignal,
) =>
  (
    await api.get<Page>(`/${resource}`, {
      params: { page, config, playerId: "local-captain" },
      signal,
    })
  ).data;
export const registerMatch = async (match: Match) =>
  (await api.post<Match>("/matches", match)).data;
