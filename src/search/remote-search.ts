import type { ApiClient } from "../api/client";
import type { SearchResult } from "./local-search";

/** Small Business search runs on the server, so it matches the same way everywhere. */
export function searchRemote(
  client: ApiClient,
  text: string,
): Promise<SearchResult[]> {
  const query = text.trim();
  if (!query) return Promise.resolve([]);
  return client.request("GET", `/api/search?q=${encodeURIComponent(query)}`);
}
