package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import static com.example.starter_project_2025.system.demo.syllabus.validation.SyllabusInputValidator.*;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusMaterialRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopic;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicCloLinkRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

/** Commands for Syllabus Topics; preserves the original order/ownership/coverage rules. */
@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusTopicService {
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final SyllabusMaterialRepository materials;
    private final SyllabusTopicCloLinkRepository coverageLinks;
    private final SyllabusWorkflowService workflow;
    private final SyllabusQueryService queries;

    private SyllabusSection section(
            Long syllabusId,
            Long sectionId
    ) {
        SyllabusSection section = sections.findById(sectionId)
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Section not found"
                        )
                );

        if (!section.getSyllabus().getId().equals(syllabusId)) {
            fail(
                    "sectionId",
                    "Section does not belong to this syllabus"
            );
        }

        return section;
    }

    private SyllabusTopic topic(
            Long syllabusId,
            Long sectionId,
            Long topicId
    ) {
        SyllabusSection parent = section(syllabusId, sectionId);

        SyllabusTopic topic = topics.findById(topicId)
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Topic not found"
                        )
                );

        if (!topic.getSection().getId().equals(parent.getId())) {
            fail(
                    "topicId",
                    "Topic does not belong to this section"
            );
        }

        return topic;
    }

    private void verifyTopicName(
            List<SyllabusTopic> siblings,
            String title,
            Long selfId
    ) {
        boolean duplicate = siblings.stream()
                .anyMatch(t ->
                        !Objects.equals(t.getId(), selfId)
                                && key(t.getTitle()).equals(key(title))
                );

        if (duplicate) {
            fail(
                    "title",
                    "Topic title already exists in this section"
            );
        }
    }

    public Detail createTopic(
            Long syllabusId,
            Long sectionId,
            TopicInput input
    ) {
        workflow.requireDraft(syllabusId);
        SyllabusSection parent = section(
                syllabusId,
                sectionId
        );

        if (input == null) {
            fail("topic", "Body is required");
        }

        String title = requiredTitle(
                input.title(),
                200,
                "title"
        );

        List<SyllabusTopic> existing =
                topics.findBySection_IdOrderByOrderIndexAsc(
                        sectionId
                );

        verifyTopicName(existing, title, null);

        int nextOrder = input.orderIndex() == null
                ? existing.stream()
                  .mapToInt(SyllabusTopic::getOrderIndex)
                  .max()
                  .orElse(0) + 1
                : requiredOrder(input.orderIndex());

        boolean duplicateOrder = existing.stream()
                .anyMatch(t ->
                        Objects.equals(t.getOrderIndex(), nextOrder)
                );

        if (duplicateOrder) {
            fail("orderIndex", "Topic order already exists in this Section");
        }

        SyllabusTopic entity = new SyllabusTopic();

        entity.setSection(parent);
        entity.setTitle(title);
        entity.setOrderIndex(nextOrder);

        topics.save(entity);

        return queries.get(syllabusId);
    }

    public Detail updateTopic(
            Long syllabusId,
            Long sectionId,
            Long topicId,
            TopicInput input
    ) {
        workflow.requireDraft(syllabusId);
        SyllabusTopic entity = topic(
                syllabusId,
                sectionId,
                topicId
        );

        if (input == null) {
            fail("topic", "Body is required");
        }

        String title = requiredTitle(
                input.title(),
                200,
                "title"
        );

        List<SyllabusTopic> siblings =
                topics.findBySection_IdOrderByOrderIndexAsc(
                        sectionId
                );

        verifyTopicName(siblings, title, topicId);

        if (input.orderIndex() != null) {
            int order = requiredOrder(input.orderIndex());

            boolean duplicateOrder = siblings.stream()
                    .anyMatch(t ->
                            !Objects.equals(t.getId(), topicId)
                                    && Objects.equals(t.getOrderIndex(), order)
                    );

            if (duplicateOrder) {
                fail(
                        "orderIndex",
                        "Topic order already exists in this Section"
                );
            }

            entity.setOrderIndex(order);
        }

        entity.setTitle(title);

        topics.save(entity);

        return queries.get(syllabusId);
    }

    public void deleteTopic(
            Long syllabusId,
            Long sectionId,
            Long topicId
    ) {
        workflow.requireDraft(syllabusId);
        SyllabusTopic entity = topic(
                syllabusId,
                sectionId,
                topicId
        );
        if (materials.countByTopic_Id(topicId) > 0) {
            fail(
                    "materials",
                    "Remove or unlink Learning Materials before deleting this Topic"
            );
        }

        coverageLinks.deleteAllForTopic(topicId);
        topics.delete(entity);
    }
}
