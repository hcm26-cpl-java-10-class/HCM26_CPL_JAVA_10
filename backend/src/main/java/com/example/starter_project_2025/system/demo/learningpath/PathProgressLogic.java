package com.example.starter_project_2025.system.demo.learningpath;

import com.example.starter_project_2025.exception.BadRequestException;

import java.util.HashSet;
import java.util.List;

/** Pure rules of a learning path, free of Spring so they are easy to test. */
public final class PathProgressLogic {

    public static final int MAX_COURSES = 12;

    public enum CourseStatus { COMPLETED, IN_PROGRESS, AVAILABLE, LOCKED }

    private PathProgressLogic() {
    }

    /**
     * A finished course is COMPLETED; one the learner is already enrolled in is IN_PROGRESS (even when staff
     * assigned it past the prerequisites); otherwise it is AVAILABLE, or LOCKED while prerequisites are missing.
     */
    public static CourseStatus status(boolean completed, boolean enrolled, boolean prerequisitesMet) {
        if (completed) {
            return CourseStatus.COMPLETED;
        }
        if (enrolled) {
            return CourseStatus.IN_PROGRESS;
        }
        return prerequisitesMet ? CourseStatus.AVAILABLE : CourseStatus.LOCKED;
    }

    public static int percent(int completed, int total) {
        return total <= 0 ? 0 : Math.min(100, completed * 100 / total);
    }

    public static boolean isComplete(int completed, int total) {
        return total > 0 && completed >= total;
    }

    /** Course ids must be 1..MAX_COURSES, non-null and unique. */
    public static void validateCourseIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new BadRequestException("A learning path needs at least one course");
        }
        if (ids.size() > MAX_COURSES) {
            throw new BadRequestException("A learning path can have at most " + MAX_COURSES + " courses");
        }
        if (ids.stream().anyMatch(java.util.Objects::isNull)) {
            throw new BadRequestException("Course ids must not be empty");
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            throw new BadRequestException("A course can appear only once in a path");
        }
    }
}
