export const RELEASE_NOTES_MAX_CHARACTERS = 1_000;

// Match Java String.length and the existing Summary limit: UTF-16 code units.
export function countReleaseNoteCharacters(value: string): number { return value.length; }

export function releaseNotesWithinLimit(value: string): boolean {
  return countReleaseNoteCharacters(value) <= RELEASE_NOTES_MAX_CHARACTERS;
}
