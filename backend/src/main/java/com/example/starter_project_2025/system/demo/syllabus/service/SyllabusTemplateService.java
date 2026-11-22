package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusClo;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCloRepository;
import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopic;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopicCloLink;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicCloLinkRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

/** Creates a new independent Draft from an existing Syllabus (including nested data). */
@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusTemplateService {

    private final SyllabusRepository syllabuses;
    private final SyllabusService syllabusService;
    private final SyllabusCloRepository clos;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final SyllabusTopicCloLinkRepository coverageLinks;

    public record CopyInput(Long sourceId, String code, String name) {}

    private static void invalid(String field, String message) {
        throw new BusinessValidationException(Map.of(field, List.of(message)));
    }

    public SyllabusModels.Detail copy(CopyInput input) {
        if (input == null || input.sourceId() == null || input.sourceId() <= 0) {
            invalid("sourceId", "Select a source Syllabus");
        }

        Syllabus source = syllabuses.findById(input.sourceId()).orElseThrow(
                () -> new ResourceNotFoundException("Source Syllabus not found")
        );

        // Reuse existing creation validation, including unique Code and Name.
        SyllabusModels.Detail created = syllabusService.create(
                new SyllabusModels.SyllabusInput(input.code(), input.name(), source.getDescription())
        );
        Syllabus target = syllabuses.findById(created.id()).orElseThrow();

        target.setTeachingMethods(source.getTeachingMethods());
        target.setDegreeLevel(source.getDegreeLevel());
        target.setTimeAllocation(source.getTimeAllocation());
        target.setStudentResponsibilities(source.getStudentResponsibilities());
        target.setRequiredTools(source.getRequiredTools());
        target.setScoringScale(source.getScoringScale());
        target.setStatus(SyllabusStatus.DRAFT);
        target.setIsActive(true);
        syllabuses.saveAndFlush(target);

        Map<Long, SyllabusClo> cloMapping = new HashMap<>();
        for (SyllabusClo original : clos.findBySyllabus_IdOrderByOrderIndexAsc(source.getId())) {
            SyllabusClo clone = new SyllabusClo();
            clone.setSyllabus(target);
            clone.setCode(original.getCode());
            clone.setDetails(original.getDetails());
            clone.setOrderIndex(original.getOrderIndex());
            clone = clos.save(clone);
            cloMapping.put(original.getId(), clone);
        }

        // Track every original Topic ID so Material links point to NEW Topics, never originals.
        Map<Long, SyllabusTopic> topicMapping = new HashMap<>();
        for (SyllabusSection originalSection :
                sections.findBySyllabus_IdOrderByOrderIndexAsc(source.getId())) {
            SyllabusSection clonedSection = new SyllabusSection();
            clonedSection.setSyllabus(target);
            clonedSection.setTitle(originalSection.getTitle());
            clonedSection.setOrderIndex(originalSection.getOrderIndex());
            clonedSection.setMission(originalSection.getMission());
            clonedSection = sections.saveAndFlush(clonedSection);

            for (SyllabusTopic originalTopic :
                    topics.findBySection_IdOrderByOrderIndexAsc(originalSection.getId())) {
                SyllabusTopic clonedTopic = new SyllabusTopic();
                clonedTopic.setSection(clonedSection);
                clonedTopic.setTitle(originalTopic.getTitle());
                clonedTopic.setOrderIndex(originalTopic.getOrderIndex());
                clonedTopic = topics.saveAndFlush(clonedTopic);
                topicMapping.put(originalTopic.getId(), clonedTopic);
            }
        }

        // Only the academic blueprint is cloned. Legacy materials are left on
        // the original Syllabus and never copied to new Drafts.

        // Preserve CLO coverage in the independent copy (never reference source entities).
        for (SyllabusTopicCloLink original : coverageLinks.findAllForSyllabus(source.getId())) {
            SyllabusTopic newTopic = topicMapping.get(original.getTopic().getId());
            SyllabusClo newClo = cloMapping.get(original.getClo().getId());
            if (newTopic == null || newClo == null) {
                throw new IllegalStateException("Syllabus template has invalid Topic-CLO links");
            }
            SyllabusTopicCloLink clonedLink = new SyllabusTopicCloLink();
            clonedLink.setTopic(newTopic);
            clonedLink.setClo(newClo);
            coverageLinks.save(clonedLink);
        }

        // Transactional: a failure at any level rolls back the entire Draft.
        return syllabusService.get(target.getId());
    }
}
