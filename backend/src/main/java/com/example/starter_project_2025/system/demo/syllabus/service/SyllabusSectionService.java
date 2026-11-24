package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import static com.example.starter_project_2025.system.demo.syllabus.validation.SyllabusInputValidator.*;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

/** Commands for Syllabus Sections; maintains the existing Draft-only and duplicate rules. */
@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusSectionService {
    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final SyllabusWorkflowService workflow;
    private final SyllabusQueryService queries;

    private Syllabus syllabus(Long id) {
        return syllabuses.findById(id)
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Syllabus not found"
                        )
                );
    }

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

    private void verifySectionName(
            List<SyllabusSection> siblings,
            String title,
            Long selfId
    ) {
        boolean duplicate = siblings.stream()
                .anyMatch(s ->
                        !Objects.equals(s.getId(), selfId)
                                && key(s.getTitle()).equals(key(title))
                );

        if (duplicate) {
            fail(
                    "title",
                    "Section title already exists in this syllabus"
            );
        }
    }

    private void verifyOrder(
            List<SyllabusSection> siblings,
            int order,
            Long selfId
    ) {
        boolean duplicate = siblings.stream()
                .anyMatch(s ->
                        !Objects.equals(s.getId(), selfId)
                                && Objects.equals(s.getOrderIndex(), order)
                );

        if (duplicate) {
            fail(
                    "orderIndex",
                    "Section order already exists in this syllabus"
            );
        }
    }

    public Detail createSection(
            Long syllabusId,
            SectionInput input
    ) {
        workflow.requireDraft(syllabusId);
        Syllabus parent = syllabus(syllabusId);

        if (input == null) {
            fail("section", "Body is required");
        }

        String title = requiredTitle(
                input.title(),
                150,
                "title"
        );

        int order = requiredOrder(input.orderIndex());

        List<SyllabusSection> existing =
                sections.findBySyllabus_IdOrderByOrderIndexAsc(
                        syllabusId
                );

        verifySectionName(existing, title, null);
        verifyOrder(existing, order, null);

        SyllabusSection entity = new SyllabusSection();
        entity.setSyllabus(parent);
        entity.setTitle(title);
        entity.setOrderIndex(order);
        entity.setMission(validMission(input.mission()));

        sections.save(entity);

        return queries.get(syllabusId);
    }

    public Detail updateSection(
            Long syllabusId,
            Long sectionId,
            SectionInput input
    ) {
        workflow.requireDraft(syllabusId);
        SyllabusSection entity = section(
                syllabusId,
                sectionId
        );

        if (input == null) {
            fail("section", "Body is required");
        }

        String title = requiredTitle(
                input.title(),
                150,
                "title"
        );

        int order = requiredOrder(input.orderIndex());

        List<SyllabusSection> siblings =
                sections.findBySyllabus_IdOrderByOrderIndexAsc(
                        syllabusId
                );

        verifySectionName(siblings, title, sectionId);
        verifyOrder(siblings, order, sectionId);

        entity.setTitle(title);
        entity.setOrderIndex(order);
        if (input.mission() != null) {
            entity.setMission(validMission(input.mission()));
        }

        sections.save(entity);

        return queries.get(syllabusId);
    }

    public Detail bulkCreateSections(
            Long syllabusId,
            BulkSectionInput input
    ) {
        workflow.requireDraft(syllabusId);
        Syllabus parent = syllabus(syllabusId);

        if (input == null
                || input.titles() == null
                || input.titles().isEmpty()
                || input.titles().size() > 30) {
            fail(
                    "titles",
                    "Please enter between 1 and 30 section titles"
            );
        }

        List<SyllabusSection> existing =
                sections.findBySyllabus_IdOrderByOrderIndexAsc(
                        syllabusId
                );

        Set<String> usedTitles = new HashSet<>();

        for (SyllabusSection section : existing) {
            usedTitles.add(key(section.getTitle()));
        }

        List<String> validTitles = new ArrayList<>();

        for (String raw : input.titles()) {
            String title = requiredTitle(
                    raw,
                    150,
                    "titles"
            );

            if (!usedTitles.add(key(title))) {
                fail(
                        "titles",
                        "Duplicate Section: " + title
                );
            }

            validTitles.add(title);
        }

        int nextOrder = existing.stream()
                .mapToInt(SyllabusSection::getOrderIndex)
                .max()
                .orElse(0) + 1;

        for (String title : validTitles) {
            SyllabusSection entity = new SyllabusSection();

            entity.setSyllabus(parent);
            entity.setTitle(title);
            entity.setOrderIndex(nextOrder++);

            sections.save(entity);
        }

        return queries.get(syllabusId);
    }

    public void deleteSection(
            Long syllabusId,
            Long sectionId
    ) {
        workflow.requireDraft(syllabusId);
        SyllabusSection entity = section(
                syllabusId,
                sectionId
        );

        if (topics.countBySection_Id(sectionId) > 0) {
            fail(
                    "topics",
                    "Delete topics before deleting this section"
            );
        }

        sections.delete(entity);
    }
}
