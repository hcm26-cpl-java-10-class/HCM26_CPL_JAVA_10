package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusCoverageService {
    private final SyllabusRepository syllabuses;
    private final SyllabusCloRepository clos;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final SyllabusTopicCloLinkRepository links;
    private final SyllabusWorkflowService workflow;

    public record TopicLinkInput(List<Long> cloIds) {}
    public record CloCoverage(Long id, String code, String details, int topicCount) {}
    public record TopicCoverage(Long id, Long sectionId, String title, List<Long> cloIds) {}
    public record CoverageView(Long syllabusId, int totalClos, int coveredClos,
                               int coveragePercent, int unlinkedTopics,
                               List<CloCoverage> clos, List<TopicCoverage> topics) {}

    private static void fail(String field, String message) {
        throw new BusinessValidationException(Map.of(field, List.of(message)));
    }

    @Transactional(readOnly = true)
    public CoverageView get(Long syllabusId) {
        if (!syllabuses.existsById(syllabusId)) {
            throw new ResourceNotFoundException("Syllabus not found");
        }
        List<SyllabusClo> allClos = clos.findBySyllabus_IdOrderByOrderIndexAsc(syllabusId);
        List<SyllabusTopic> allTopics = new ArrayList<>();
        for (SyllabusSection section : sections.findBySyllabus_IdOrderByOrderIndexAsc(syllabusId)) {
            allTopics.addAll(topics.findBySection_IdOrderByOrderIndexAsc(section.getId()));
        }

        Map<Long, Set<Long>> byTopic = new LinkedHashMap<>();
        for (SyllabusTopic topic : allTopics) byTopic.put(topic.getId(), new LinkedHashSet<>());
        for (SyllabusTopicCloLink link : links.findAllForSyllabus(syllabusId)) {
            Set<Long> linked = byTopic.get(link.getTopic().getId());
            if (linked != null) linked.add(link.getClo().getId());
        }
        Set<Long> cloIds = allClos.stream().map(SyllabusClo::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        SyllabusCoverageAlgorithm.Result result = SyllabusCoverageAlgorithm.analyze(cloIds, byTopic);

        List<CloCoverage> coveredClos = allClos.stream()
                .map(c -> new CloCoverage(c.getId(), c.getCode(), c.getDetails(),
                        result.topicCountsByClo().getOrDefault(c.getId(), 0)))
                .toList();
        List<TopicCoverage> mappedTopics = allTopics.stream()
                .map(t -> new TopicCoverage(t.getId(), t.getSection().getId(),
                        t.getTitle(), List.copyOf(byTopic.get(t.getId()))))
                .toList();
        return new CoverageView(syllabusId, result.totalClos(), result.coveredClos(),
                result.coveragePercent(), result.unlinkedTopics(), coveredClos, mappedTopics);
    }

    public CoverageView setTopicClos(Long syllabusId, Long topicId, TopicLinkInput input) {
        workflow.requireDraft(syllabusId);
        if (input == null || input.cloIds() == null) {
            fail("cloIds", "Select CLOs or submit an empty list to clear links");
        }
        SyllabusTopic topic = topics.findById(topicId)
                .orElseThrow(() -> new ResourceNotFoundException("Topic not found"));
        if (!topic.getSection().getSyllabus().getId().equals(syllabusId)) {
            throw new ResourceNotFoundException("Topic does not belong to this Syllabus");
        }

        Set<Long> desired = new LinkedHashSet<>();
        for (Long id : input.cloIds()) {
            if (id == null || id <= 0) fail("cloIds", "Invalid CLO ID");
            desired.add(id);
        }
        Map<Long, SyllabusClo> valid = clos.findBySyllabus_IdOrderByOrderIndexAsc(syllabusId)
                .stream().collect(Collectors.toMap(SyllabusClo::getId, c -> c));
        if (!valid.keySet().containsAll(desired)) {
            fail("cloIds", "All selected CLOs must belong to this Syllabus");
        }

        // Validate the entire request BEFORE changing any links.
        links.deleteAllForTopic(topicId);
        List<SyllabusTopicCloLink> replacements = new ArrayList<>();
        for (Long cloId : desired) {
            SyllabusTopicCloLink link = new SyllabusTopicCloLink();
            link.setTopic(topic);
            link.setClo(valid.get(cloId));
            replacements.add(link);
        }
        links.saveAllAndFlush(replacements);
        return get(syllabusId);
    }
}
