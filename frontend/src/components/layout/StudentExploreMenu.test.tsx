import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { StudentExploreMenu } from "./StudentExploreMenu";

const mocks = vi.hoisted(() => ({ getCatalogCategories: vi.fn() }));
vi.mock("@/api", () => ({ courseApi: { getCatalogCategories: mocks.getCatalogCategories } }));

function renderMenu(canBrowse = true, canRecommend = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/courses"]}>
        <StudentExploreMenu canBrowse={canBrowse} canRecommend={canRecommend} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getCatalogCategories.mockReset();
  mocks.getCatalogCategories.mockResolvedValue([
    { id: 4, name: "Development", code: "DEV", totalCourseCount: 2, children: [
      { id: 9, name: "Java", code: "JAVA", totalCourseCount: 1, children: [] },
    ] },
    { id: 12, name: "Empty", code: "EMPTY", totalCourseCount: 0, children: [] },
  ]);
});

it("opens from the keyboard, links real categories, and restores focus on Escape", async () => {
  const user = userEvent.setup();
  renderMenu();
  const trigger = screen.getByRole("button", { name: "Explore courses" });
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("menu")).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Browse courses" })).toHaveAttribute("href", "/courses");
  expect(screen.getByRole("menuitem", { name: "For you" })).toHaveAttribute("href", "/student/recommendations");
  expect(screen.getByRole("menuitem", { name: "Java" })).toHaveAttribute("href", "/courses?category=9");
  expect(screen.queryByRole("menuitem", { name: "Empty" })).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

it("does not expose catalog destinations or call the API without COURSE_READ", () => {
  renderMenu(false, true);
  expect(screen.queryByRole("button", { name: "Explore courses" })).not.toBeInTheDocument();
  expect(mocks.getCatalogCategories).not.toHaveBeenCalled();
});
