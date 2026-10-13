import { useCallback, useEffect, useRef, useState } from "react";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { registerMatch } from "../api/client";
import type { Match } from "../api/contracts";
import { read, write } from "../api/storage";

function readPending(): Match[] {
  const stored = read<Match[]>("pending", []);
  return Array.isArray(stored) ? stored : [];
}

export function useMatchSubmission() {
  const client = useQueryClient();
  const [pending, setPending] = useState(readPending);
  const inFlight = useRef(new Set<string>());

  const sendingCount = useIsMutating({
    mutationKey: ["submit-match"],
  });

  const { mutate } = useMutation({
    mutationKey: ["submit-match"],
    scope: { id: "match-submissions" },
    retry: 1,
    networkMode: "always",

    mutationFn: async (match: Match) => {
      const confirmed = await registerMatch(match);

      if (confirmed.id !== match.id) {
        throw new Error("The server returned an unexpected match.");
      }

      return confirmed;
    },

    onSuccess: (_confirmed, submitted) => {
      const remaining = readPending().filter(
        (match) => match.id !== submitted.id,
      );

      write("pending", remaining);
      setPending(remaining);

      void client.invalidateQueries({ queryKey: ["ranking"] });
      void client.invalidateQueries({ queryKey: ["history"] });
    },

    onSettled: (_data, _error, submitted) => {
      inFlight.current.delete(submitted.id);
    },
  });

  const send = useCallback(
    (match: Match) => {
      if (inFlight.current.has(match.id)) return;

      inFlight.current.add(match.id);
      mutate(match);
    },
    [mutate],
  );

  useEffect(() => {
    // Recover unfinished submissions after a reload.
    for (const match of readPending()) {
      send(match);
    }
  }, [send]);

  const submit = (match: Match) => {
    const current = readPending();
    const next = current.some((item) => item.id === match.id)
      ? current
      : [...current, match];

    // Persist before starting the request.
    write("pending", next);
    write("last", match);
    setPending(next);
    send(match);
  };

  const retryPending = () => {
    for (const match of readPending()) {
      send(match);
    }
  };

  return {
    pending,
    isSending: sendingCount > 0,
    submit,
    retryPending,
  };
}