import type { CategoryTreeDTO, CourseLevel } from "@/types";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const normalizedToken = (text: string) => {
  if (["network", "networks", "networking"].includes(text)) return "network";
  if (["database", "databases"].includes(text)) return "database";
  return text.replace(/s$/, "");
};
const tokens = (text: string) => normalize(text).split(/[^a-z0-9]+/)
  .filter((t) => t.length > 2 && !["course", "learn", "learning", "essentials", "class", "basic", "basics", "introduction", "fundamentals"].includes(t))
  .map(normalizedToken);

/** Course level is difficulty, NEVER mapped from the academic degreeLevel. */
export function recommendCourseLevel(name: string, description?: string | null): { level: CourseLevel; reason: string } {
  const title = normalize(name);
  const descriptionText = normalize(description || "");
  if (/\b(advanced|expert|mastery|chuyen sau)\b/.test(title)) {
    return { level: "ADVANCED", reason: "Suggested from the course title; review the difficulty." };
  }
  if (/\b(beginner|fundamental|fundamentals|basic|basics|intro|introduction|essentials|nhap mon|co ban)\b/.test(title)) {
    return { level: "BEGINNER", reason: "Suggested from introductory wording in the title." };
  }
  if (/\b(intermediate|spring boot|object.oriented|oop|framework|algorithms|data structures)\b/.test(title)) {
    return { level: "INTERMEDIATE", reason: "Suggested from the topic in the title; you can change it." };
  }
  if (/\b(advanced|expert|optimization)\b/.test(descriptionText)) {
    return { level: "ADVANCED", reason: "Tentatively suggested from the description; verify before creating." };
  }
  return { level: "BEGINNER", reason: "Starting suggestion only (difficulty is not determined by Degree Level)." };
}

export interface CategoryOption { id: number; name: string; path: string; code: string }

export function flattenCategoryTree(tree: CategoryTreeDTO[]): CategoryOption[] {
  const result: CategoryOption[] = [];
  const visit = (nodes: CategoryTreeDTO[], parent = "") => {
    for (const node of nodes) {
      const path = parent ? `${parent} / ${node.name}` : node.name;
      if (node.isActive !== false) result.push({ id: node.id, name: node.name, path, code: node.code });
      if (node.children?.length) visit(node.children, path);
    }
  };
  visit(tree);
  return result;
}

/** Recommend existing category IDs only, never create guessed categories. */
export function recommendCategoryIds(name: string, description: string | null | undefined, options: CategoryOption[]): number[] {
  const title = normalize(name);
  const titleWords = new Set(tokens(name));
  const descriptionWords = new Set(tokens(description || ""));
  const rank = options.map((option) => {
    const categoryWords = tokens(`${option.name} ${option.code}`);
    const titleMatches = categoryWords.filter((word) => titleWords.has(word)).length;
    const descriptionMatches = categoryWords.filter((word) => descriptionWords.has(word)).length;
    const completeName = normalize(option.name);
    const score = (title.includes(completeName) ? 8 : 0) + titleMatches * 4 + descriptionMatches;
    return { id: option.id, score };
  }).sort((a, b) => b.score - a.score);
  return rank[0] && rank[0].score >= 4 ? [rank[0].id] : [];
}
