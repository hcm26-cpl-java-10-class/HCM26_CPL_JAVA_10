import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import "./index.css";
import { store } from "./store/store";

export const queryClient = new QueryClient();

// Cached server data belongs to the signed-in user: drop all of it when the user changes
// (logout, or a login as someone else), so one account never sees another's answers.
// A token refresh keeps the same e-mail and keeps the cache.
let cachedFor = store.getState().auth.email;
store.subscribe(() => {
  const email = store.getState().auth.email;
  if (email === cachedFor) return;
  cachedFor = email;
  queryClient.clear();
});

const THEME_STORAGE_KEY = "theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

const initializeTheme = () => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia(SYSTEM_THEME_QUERY).matches;
  const resolvedTheme =
    storedTheme === "light"
      ? "light"
      : storedTheme === "dark"
        ? "dark"
        : prefersDark
          ? "dark"
          : "light";

  const root = document.documentElement;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
};

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
