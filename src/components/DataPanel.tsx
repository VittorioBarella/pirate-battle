import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPage } from "../api/client";
import { playerId } from "../api/contracts";

interface DataPanelProps {
  resource: "ranking" | "history";
  config: string;
}

export function DataPanel({ resource, config }: DataPanelProps) {
  const [page, setPage] = useState(1);
  const title = resource === "ranking" ? "Ranking" : "History";

  const query = useQuery({
    queryKey: [resource, config, playerId, page],
    queryFn: ({ signal }) => fetchPage(resource, page, config, signal),
    staleTime: 0,
    refetchOnMount: true,
  });

  const data = query.data;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <section className="data-panel" aria-labelledby="data-title">
      <div className="panel-heading">
        <h2 id="data-title">{title}</h2>
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh
        </button>
      </div>

      <p className="muted">
        {resource === "ranking"
          ? "Scores from battles with the same gameplay configuration."
          : "Your completed and successfully registered battles."}
      </p>

      <div role="status" aria-live="polite">
        {query.isFetching
          ? data
            ? "Updating records…"
            : "Loading records…"
          : ""}
      </div>

      {query.isError && (
        <div role="alert">
          <p>
            {data
              ? "Refresh failed. Previously loaded records are shown."
              : `Could not load ${title.toLowerCase()}. Please try again.`}
          </p>
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          {data.items.length === 0 ? (
            <p>
              {resource === "ranking"
                ? "No scores for this configuration yet."
                : "No registered battles on this page yet."}
            </p>
          ) : (
            <div className="table-wrap">
              <table aria-label={`${title} records`}>
                <thead>
                  <tr>
                    {resource === "ranking" && <th scope="col">Rank</th>}
                    <th scope="col">Captain</th>
                    <th scope="col">Score</th>
                    <th scope="col">Time</th>
                    <th scope="col">End reason</th>
                    <th scope="col">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((match, index) => (
                    <tr key={match.id}>
                      {resource === "ranking" && (
                        <td>{(data.page - 1) * data.pageSize + index + 1}</td>
                      )}
                      <td>{match.playerName}</td>
                      <td>{match.score}</td>
                      <td>{match.duration.toFixed(1)}s</td>
                      <td>
                        {match.reason === "death" ? "Destroyed" : "Time expired"}
                      </td>
                      <td>
                        <time dateTime={match.date}>
                          {new Date(match.date).toLocaleString("en-US")}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <nav className="pagination" aria-label={`${title} pagination`}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>

        <span>
          Page {page}
          {data ? ` of ${totalPages} · ${data.total} records` : ""}
        </span>

        <button
          type="button"
          disabled={!data || page >= totalPages || query.isFetching}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </nav>
    </section>
  );
}