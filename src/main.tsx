import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { worker } from "./mocks/browser";
import "./styles.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: true, retry: 1 },
    mutations: { retry: 1 },
  },
});
const root = ReactDOM.createRoot(document.getElementById("root")!);
// The challenge has no real backend: MSW must also start in the production build.
worker
  .start({ onUnhandledRequest: "bypass", quiet: true })
  .then(() =>
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={client}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="card">
        <h1>Unable to start the harbor</h1>
        <p>
          The API simulation requires HTTPS or localhost and service worker
          support.
        </p>
        <button onClick={() => location.reload()}>Retry</button>
      </main>,
    ),
  );
