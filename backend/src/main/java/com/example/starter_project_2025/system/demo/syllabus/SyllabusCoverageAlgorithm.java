package com.example.starter_project_2025.system.demo.syllabus;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Pure, deterministic calculation. A CLO is covered when >= 1 Topic references it. */
public final class SyllabusCoverageAlgorithm {
    private SyllabusCoverageAlgorithm() {}

    public record Result(int totalClos, int coveredClos, int coveragePercent,
                         int unlinkedTopics, List<Long> uncoveredCloIds,
                         Map<Long, Integer> topicCountsByClo) {}

    public static Result analyze(Set<Long> cloIds, Map<Long, Set<Long>> cloIdsByTopic) {
        if (cloIds == null || cloIdsByTopic == null) {
            throw new IllegalArgumentException("CLOs and Topics are required");
        }

        Map<Long, Integer> counts = new LinkedHashMap<>();
        for (Long cloId : cloIds) {
            counts.put(cloId, 0);
        }
        int unlinkedTopics = 0;
        for (Set<Long> linked : cloIdsByTopic.values()) {
            if (linked == null || linked.isEmpty()) {
                unlinkedTopics++;
                continue;
            }
            for (Long cloId : linked) {
                if (counts.containsKey(cloId)) {
                    counts.merge(cloId, 1, Integer::sum);
                }
            }
        }
        List<Long> uncovered = new ArrayList<>();
        for (Map.Entry<Long, Integer> entry : counts.entrySet()) {
            if (entry.getValue() == 0) uncovered.add(entry.getKey());
        }
        int total = counts.size();
        int covered = total - uncovered.size();
        int percent = total == 0 ? 0 : (int) Math.round(covered * 100.0 / total);
        return new Result(total, covered, percent, unlinkedTopics,
                List.copyOf(uncovered), Map.copyOf(counts));
    }
}
