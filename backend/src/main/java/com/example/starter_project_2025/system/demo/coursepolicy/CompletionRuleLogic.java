package com.example.starter_project_2025.system.demo.coursepolicy;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Pure rules, kept free of Spring so they are easy to test. */
public final class CompletionRuleLogic {

    public static final int DEFAULT_MIN_LESSON_PERCENT = 100;
    public static final boolean DEFAULT_REQUIRE_ASSESSMENTS_PASS = true;

    private CompletionRuleLogic() {
    }

    /** Lessons a learner must finish: ceil(active * percent / 100), and at least 1 when the course has lessons. */
    public static int requiredLessons(int activeLessons, int minPercent) {
        if (activeLessons <= 0) {
            return 0;
        }
        int percent = Math.min(100, Math.max(1, minPercent));
        int required = (int) Math.ceil(activeLessons * percent / 100.0);
        return Math.max(1, required);
    }

    public static boolean lessonsDone(int activeLessons, int completedActiveLessons, int minPercent) {
        return activeLessons > 0 && completedActiveLessons >= requiredLessons(activeLessons, minPercent);
    }

    /**
     * Would adding the edge course -> newPrerequisite create a loop?
     * graph maps a course id to the ids of its prerequisites. A loop appears when course is already
     * reachable by following prerequisites from newPrerequisite (or they are the same course).
     */
    public static boolean createsCycle(Long courseId, Long newPrerequisiteId, Map<Long, Set<Long>> graph) {
        if (courseId.equals(newPrerequisiteId)) {
            return true;
        }
        Set<Long> seen = new HashSet<>();
        Deque<Long> stack = new ArrayDeque<>();
        stack.push(newPrerequisiteId);
        while (!stack.isEmpty()) {
            Long current = stack.pop();
            if (!seen.add(current)) {
                continue;
            }
            for (Long next : graph.getOrDefault(current, Set.of())) {
                if (next.equals(courseId)) {
                    return true;
                }
                stack.push(next);
            }
        }
        return false;
    }
}
