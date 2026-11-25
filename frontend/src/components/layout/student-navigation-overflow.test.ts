import { expect, it } from "vitest";
import { fittingNavigationCount } from "./student-navigation-overflow";
it("keeps later groups in More after System Management even on wide screens", () => {
  expect(fittingNavigationCount([100,100,100,100,100,100,100],2000,6)).toBe(6);
});
it("reserves More space and moves earlier groups as available width shrinks", () => {
  expect(fittingNavigationCount([100,100,100],260,3)).toBe(2);
  expect(fittingNavigationCount([100,100,100],200,3)).toBe(1);
  expect(fittingNavigationCount([100,100,100],100,3)).toBe(0);
  expect(fittingNavigationCount([100,100,100],400,3)).toBe(3);
});
it("handles exact fits, empty navigation and resized labels", () => {
  expect(fittingNavigationCount([100,100],208,2)).toBe(2);
  expect(fittingNavigationCount([],40,0)).toBe(0);
  expect(fittingNavigationCount([180,180,180],260,3)).toBe(1);
});
