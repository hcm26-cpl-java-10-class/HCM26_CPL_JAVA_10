export const RELEASE_NOTES_MAX_WORDS = 1_000;

export function countReleaseNoteWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

export function releaseNotesWithinLimit(value: string): boolean {
  return countReleaseNoteWords(value) <= RELEASE_NOTES_MAX_WORDS;
}
