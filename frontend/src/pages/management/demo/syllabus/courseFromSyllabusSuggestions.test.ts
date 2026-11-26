import { describe, it, expect } from "vitest";
import type { CategoryTreeDTO } from "@/types";
import { flattenCategoryTree } from "./courseFromSyllabusSuggestions";

describe("Course-from-Syllabus category options", () => {
  it("includes active unused Category nodes returned by the full tree", () => {
    const fullTree = [
      { id: 1, name: "Programming", code: "PROG", isActive: true, children: [
        { id: 2, name: "Game Development", code: "GAME", isActive: true, children: [] },
      ] },
      { id: 3, name: "Inactive", code: "OLD", isActive: false, children: [
        { id: 4, name: "Hidden Child", code: "CHILD", isActive: true, children: [] },
      ] },
    ] as unknown as CategoryTreeDTO[];
    expect(flattenCategoryTree(fullTree).map((x) => [x.id, x.path])).toEqual([
      [1, "Programming"], [2, "Programming / Game Development"],
    ]);
  });
});
