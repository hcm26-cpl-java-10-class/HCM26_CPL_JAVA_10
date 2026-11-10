package com.example.starter_project_2025.system.demo.syllabus;

import org.junit.jupiter.api.Test;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

class SyllabusCoverageAlgorithmTest {
    @Test
    void noClosDoesNotDivideByZero() {
        var result = SyllabusCoverageAlgorithm.analyze(Set.of(), Map.of(11L, Set.of()));
        assertEquals(0, result.coveragePercent());
        assertEquals(1, result.unlinkedTopics());
        assertTrue(result.uncoveredCloIds().isEmpty());
    }

    @Test
    void partialCoverageAndUnmappedTopics() {
        Map<Long, Set<Long>> mapping = new LinkedHashMap<>();
        mapping.put(10L, Set.of(1L));
        mapping.put(20L, Set.of(1L, 2L));
        mapping.put(30L, Set.of());
        var result = SyllabusCoverageAlgorithm.analyze(
                new LinkedHashSet<>(java.util.List.of(1L, 2L, 3L)), mapping);
        assertEquals(3, result.totalClos());
        assertEquals(2, result.coveredClos());
        assertEquals(67, result.coveragePercent());
        assertEquals(1, result.unlinkedTopics());
        assertEquals(java.util.List.of(3L), result.uncoveredCloIds());
        assertEquals(Integer.valueOf(2), result.topicCountsByClo().get(1L));
    }

    @Test
    void allCoveredAtLeastOneTopicEach() {
        var result = SyllabusCoverageAlgorithm.analyze(Set.of(1L, 2L),
                Map.of(100L, Set.of(1L, 2L), 200L, Set.of(2L)));
        assertEquals(100, result.coveragePercent());
        assertEquals(0, result.unlinkedTopics());
    }
}
