import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import "./index.css";
import { store } from "./store/store";
import { setAuthInitialized, setLogin } from "./store/slices/auth/authSlice";
import { installAuthTabSessionBridge } from "./store/slices/auth/authTabSession";

export const queryClient = new QueryClient();

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
installAuthTabSessionBridge(
  () => store.getState().auth,
  (session) => store.dispatch(setLogin(session)),
  () => store.dispatch(setAuthInitialized()),
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
