import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export const GitActivityUrlContext = createContext<{ params: URLSearchParams; write: (key: string, value: string | null) => void } | null>(null);

export function useGitActivityParam<T extends string | number | boolean | null | undefined>(
  key: string, fallback: T, kind: "string" | "number" | "boolean" = typeof fallback === "number" ? "number"
    : typeof fallback === "boolean" ? "boolean" : "string",
): [T, Dispatch<SetStateAction<T>>] {
  const state = useContext(GitActivityUrlContext);
  if (!state) throw new Error("Git Activity URL state is missing");
  const raw = state.params.get(key);
  const value = (raw == null ? fallback : raw === "~" ? undefined : raw === "~null" ? null
    : kind === "number" ? /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : fallback
    : kind === "boolean" ? raw === "true" : raw) as T;
  return [value, next => {
    const result = typeof next === "function" ? next(value) : next;
    state.write(key, result === fallback ? null : result === undefined ? "~" : result === null ? "~null" : String(result));
  }];
}
