/**
 * Which audit entity type belongs to which admin page, so the header "History" button can open the
 * right log without every page having to wire it.
 *
 * Add a line here only when the default guess is wrong. The default takes the last URL segment of the
 * page and turns it into an entity type ("/course-enrollments" -> COURSE_ENROLLMENT); the button then
 * only shows if that type really exists in the audit log.
 */
const ROUTE_OVERRIDES: Record<string, string> = {
  "/management/workspaces": "WORKSPACE",
  "/programs": "TRAINING_PROGRAM",
  "/menus": "MODULE",
  "/menu-groups": "MODULE_GROUP",
  "/enrollments": "COURSE_ENROLLMENT",
  "/exams/appeals": "SCORE_APPEAL",
  "/syllabuses": "SYLLABUS",
  "/curriculum": "CURRICULUM",
};

function singular(word: string) {
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith("ses") || word.endsWith("xes")) return word.slice(0, -2);
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

export function resolveAuditEntityType(
  pathname: string,
  knownTypes: string[],
): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const known = new Set(knownTypes.map((type) => type.toUpperCase()));

  // longest matching override wins
  const override = Object.keys(ROUTE_OVERRIDES)
    .filter((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (override) {
    const type = ROUTE_OVERRIDES[override];
    return known.has(type) ? type : null;
  }

  const segments = path
    .split("/")
    .filter((segment) => segment && !/^\d+$/.test(segment) && !/^[0-9a-f-]{32,}$/i.test(segment));
  const last = segments[segments.length - 1];

  if (!last) return null;

  const guess = last.split("-").map(singular).join("_").toUpperCase();
  const guessPlural = last.split("-").join("_").toUpperCase();

  if (known.has(guess)) return guess;
  if (known.has(guessPlural)) return guessPlural;
  return null;
}
