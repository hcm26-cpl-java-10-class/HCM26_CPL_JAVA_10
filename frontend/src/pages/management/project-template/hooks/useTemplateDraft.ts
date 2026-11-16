import { useState, type SetStateAction } from "react";

export function useTemplateDraft<T extends object>(
  savedValues: T,
  lockVersion: number,
  fingerprint: (values: T) => string = JSON.stringify,
) {
  const saved = fingerprint(savedValues);
  const [draft, setDraft] = useState(() => ({ values: savedValues, saved, lockVersion }));
  const hasChanges = fingerprint(draft.values) !== draft.saved;

  // A save on another tab can advance the revision without changing this section.
  if (lockVersion > draft.lockVersion && (!hasChanges || saved === draft.saved)) {
    setDraft({ values: saved === draft.saved ? draft.values : savedValues, saved, lockVersion });
  }

  function setValues(update: SetStateAction<T>) {
    setDraft(current => ({ ...current, values: typeof update === "function" ? update(current.values) : update }));
  }

  function acceptSaved(values: T, revision: number) {
    setDraft({ values, saved: fingerprint(values), lockVersion: revision });
  }

  return { values: draft.values, setValues, hasChanges, lockVersion: draft.lockVersion, acceptSaved };
}
