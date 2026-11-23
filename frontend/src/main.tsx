import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import "./index.css";
import { store } from "./store/store";
import { setAuthInitialized, setLogin, setLogout } from "./store/slices/auth/authSlice";
import { installAuthTabSessionBridge } from "./store/slices/auth/authTabSession";
import { authApi } from "./api/features/auth.api";
import { installCrossTabLogoutListener } from "./utils/auth-logout";

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
  window,
  () => authApi.refreshSession(),
);
installCrossTabLogoutListener(() => {
  if (store.getState().auth.isAuthenticated) {
    queryClient.clear();
    store.dispatch(setLogout());
    window.location.href = "/login";
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
