package com.example.starter_project_2025.system.demo.course;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class CourseSourceScopeTest {
    @Test
    void fullAndFocusedWithAllSelectedProduceSameKey() {
        assertEquals(CourseSourceScope.key(List.of(30L, 20L, 10L)),
                CourseSourceScope.key(List.of(10L, 30L, 20L)));
        assertNotEquals(CourseSourceScope.key(List.of(10L, 20L)),
                CourseSourceScope.key(List.of(10L, 20L, 30L)));
    }

    @Test
    void normalizedNamesIgnoreCaseAndWhitespace() {
        assertEquals(CourseSourceScope.nameKey(" SQL  Basics "),
                CourseSourceScope.nameKey("sql basics"));
    }
    @org.junit.jupiter.api.Test
    void v2FingerprintBlocksIdenticalOutlinesEvenIfTopicOrderDiffers() {
        var outline = java.util.List.of(new CourseFromSyllabusModels.DraftSection("SQL Basics",
                java.util.List.of("Introduction", "Filtering")));
        org.junit.jupiter.api.Assertions.assertEquals(
                CourseSourceScope.outlineKey(java.util.List.of(2L, 1L), outline),
                CourseSourceScope.outlineKey(java.util.List.of(1L, 2L), outline));
        org.junit.jupiter.api.Assertions.assertNotEquals(
                CourseSourceScope.outlineKey(java.util.List.of(1L, 2L), outline),
                CourseSourceScope.outlineKey(java.util.List.of(1L, 2L),
                    java.util.List.of(new CourseFromSyllabusModels.DraftSection("SQL Basics",
                        java.util.List.of("Introduction", "Filtering Practice")))));
    }

}
