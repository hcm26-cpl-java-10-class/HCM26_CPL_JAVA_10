import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { CourseCard } from "./CourseCard";

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

const sampleCourse = {
  id: 42,
  name: "Java 21 Masterclass",
  description: "Modern Java",
  instructor: "Teacher",
  categoryName: "Backend",
  level: "BEGINNER" as const,
  lessonCount: 10,
  totalDuration: 3600,
  isFree: true,
  enrolled: false,
  averageRating: 4.8,
  totalReviews: 12,
};

it("toggles bookmark on CourseCard without navigating away from the current page", async () => {
  const user = userEvent.setup();
  const onToggleBookmark = vi.fn();

  render(
    <MemoryRouter initialEntries={["/courses"]}>
      <CourseCard
        course={sampleCourse}
        canEnroll={false}
        isEnrolling={false}
        canAssign={false}
        showDetailAction
        onEnroll={vi.fn()}
        isSaved={false}
        onToggleBookmark={onToggleBookmark}
      />
      <Location />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("button", { name: "Save Java 21 Masterclass for later" }));

  expect(onToggleBookmark).toHaveBeenCalledTimes(1);
  expect(onToggleBookmark).toHaveBeenCalledWith(42);
  expect(screen.getByTestId("location")).toHaveTextContent("/courses");
});
