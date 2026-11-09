import type { QueryClient } from "@tanstack/react-query";
import type { RootState } from "@/store/store";

type AuthStore = { getState: () => Pick<RootState, "auth">; subscribe: (listener: () => void) => () => void };

export function isolateQuerySession(client: QueryClient, store: AuthStore) {
  const session = () => {
    const auth = store.getState().auth;
    return JSON.stringify([auth.isAuthenticated, auth.email, [...auth.permissions].sort()]);
  };
  let previous = session();
  return store.subscribe(() => {
    const next = session();
    if (next !== previous) {
      previous = next;
      client.clear(); // Cancel/remove old account and old permission-scope queries.
    }
  });
}
