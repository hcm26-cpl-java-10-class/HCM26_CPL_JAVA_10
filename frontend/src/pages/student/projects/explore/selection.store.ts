import { useSyncExternalStore } from "react";

/**
 * US-09 selection state shared between the catalogue (`/student/projects/explore`)
 * and the full detail page (`/student/projects/detail/:projectId`).
 * <p>
 * The selection used to live inside a single page component; because the detail
 * view is now a separate route, the value is kept in a tiny module-level store
 * (mirrored into `sessionStorage`) so it survives navigation and a page reload.
 */
const STORAGE_KEY = "us09.selected-project-id";

const listeners = new Set<() => void>();

const readStoredValue = (): string | null => {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

let selectedProjectId: string | null = readStoredValue();

export const getSelectedProjectId = (): string | null => selectedProjectId;

export const setSelectedProjectId = (projectId: string | null): void => {
  if (selectedProjectId === projectId) return;

  selectedProjectId = projectId;

  if (typeof window !== "undefined") {
    try {
      if (projectId) {
        window.sessionStorage.setItem(STORAGE_KEY, projectId);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Private mode / disabled storage: the in-memory value still works.
    }
  }

  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Reactive access to the project selected for the student's team. */
export const useSelectedProjectId = (): string | null =>
  useSyncExternalStore(subscribe, getSelectedProjectId, () => null);
