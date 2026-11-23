package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusQueryService;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusSectionService;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusTopicService;
import static com.example.starter_project_2025.system.demo.syllabus.validation.SyllabusInputValidator.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCloRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusMaterialRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;

@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusService {
    private final SyllabusCloRepository clos;
    private final SyllabusMaterialRepository materials;
    private final SyllabusRepository syllabuses;
    private final CourseRepository courses;
    private final SyllabusSectionRepository sections;

    private final SyllabusWorkflowService workflow;
    private final SyllabusQueryService queries;
    private final SyllabusSectionService sectionCommands;
    private final SyllabusTopicService topicCommands;


    private Syllabus syllabus(Long id) {
        return syllabuses.findById(id)
                .orElseThrow(
                        () -> new ResourceNotFoundException(
                                "Syllabus not found"
                        )
                );
    }


    @Transactional(readOnly = true)
    public List<Summary> list(String query) {
        return queries.list(query);
    }


    @Transactional(readOnly = true)
    public Detail get(Long id) {
        return queries.get(id);
    }

    private void fillSyllabus(
            Syllabus entity,
            SyllabusInput input
    ) {
        if (input == null) {
            fail("syllabus", "Body is required");
        }

        String code = clean(input.code())
                .toUpperCase(Locale.ROOT);

        String name = requiredTitle(
                input.name(),
                150,
                "name"
        );

        String description = clean(input.description());

        if (!code.matches("[A-Z0-9][A-Z0-9_-]{2,29}")) {
            fail(
                    "code",
                    "Code must be 3-30 characters: A-Z, 0-9, _ or -"
            );
        }

        if (description.length() > 1500) {
            fail(
                    "description",
                    "Description exceeds 1500 characters"
            );
        }

        boolean duplicate = syllabuses.search("")
                .stream()
                .anyMatch(s ->
                        !Objects.equals(s.getId(), entity.getId())
                                && (
                                s.getCode().equalsIgnoreCase(code)
                                        || key(s.getName()).equals(key(name))
                        )
                );

        if (duplicate) {
            fail(
                    "code",
                    "Syllabus code or name already exists"
            );
        }

        entity.setCode(code);
        entity.setName(name);
        entity.setDescription(description);
    }

    public Detail create(SyllabusInput input) {
        Syllabus entity = new Syllabus();

        fillSyllabus(entity, input);

        return get(
                syllabuses.saveAndFlush(entity).getId()
        );
    }

    public Detail update(
            Long id,
            SyllabusInput input
    ) {
        workflow.requireDraft(id);
        Syllabus entity = syllabus(id);

        fillSyllabus(entity, input);

        syllabuses.saveAndFlush(entity);

        return get(id);
    }

    public void delete(Long id) {
        workflow.requireDraft(id);
        if (courses.existsBySyllabus_Id(id)) {
            fail("syllabusId", "Remove this Syllabus from all Courses before deleting it");
        }
        Syllabus entity = syllabus(id);
        if (clos.countBySyllabus_Id(id) > 0) {
            fail("clos", "Delete all CLOs before deleting this Syllabus");
        }

        if (sections.countBySyllabus_Id(id) > 0) {
            fail(
                    "sections",
                    "Delete all sections before deleting this syllabus"
            );
        }

        // Legacy archived resources are removed only when the user explicitly
        // deletes this entire Draft Syllabus, after other safety checks passed.
        var archivedMaterials = materials.findBySyllabus_IdOrderByIdAsc(id);
        if (!archivedMaterials.isEmpty()) {
            materials.deleteAll(archivedMaterials);
            materials.flush();
        }
        syllabuses.delete(entity);
    }


    public Detail createSection(Long syllabusId, SectionInput input) {
        return sectionCommands.createSection(syllabusId, input);
    }

    public Detail updateSection(Long syllabusId, Long sectionId, SectionInput input) {
        return sectionCommands.updateSection(syllabusId, sectionId, input);
    }

    public Detail bulkCreateSections(Long syllabusId, BulkSectionInput input) {
        return sectionCommands.bulkCreateSections(syllabusId, input);
    }

    public void deleteSection(Long syllabusId, Long sectionId) {
        sectionCommands.deleteSection(syllabusId, sectionId);
    }


    public Detail createTopic(Long syllabusId, Long sectionId, TopicInput input) {
        return topicCommands.createTopic(syllabusId, sectionId, input);
    }

    public Detail updateTopic(Long syllabusId, Long sectionId, Long topicId, TopicInput input) {
        return topicCommands.updateTopic(syllabusId, sectionId, topicId, input);
    }

    public void deleteTopic(Long syllabusId, Long sectionId, Long topicId) {
        topicCommands.deleteTopic(syllabusId, sectionId, topicId);
    }

    @Transactional(readOnly = true)
    public ValidationResult validate(Long syllabusId) {
        var progress = workflow.progress(syllabusId);

        return new ValidationResult(
                progress.canPublish(),
                progress.missing()
        );
    }


    @Transactional(readOnly = true)
    public InformationView getInformation(Long syllabusId) {
        return queries.getInformation(syllabusId);
    }

    public InformationView updateInformation(
            Long syllabusId,
            InformationInput input
    ) {
        workflow.requireDraft(syllabusId);
        if (input == null) {
            fail("information", "Request body is required");
        }

        Syllabus entity = syllabus(syllabusId);

        // Reuse existing validation for code, name and duplicate values.
        fillSyllabus(
                entity,
                new SyllabusInput(
                        input.code(),
                        input.name(),
                        input.description()
                )
        );

        String description = informationText(
                input.description(), 1500, "description"
        );

        String teachingMethods = informationText(
                input.teachingMethods(), 500, "teachingMethods"
        );

        String degreeLevel = informationText(
                input.degreeLevel(), 100, "degreeLevel"
        );

        String timeAllocation = informationText(
                input.timeAllocation(), 500, "timeAllocation"
        );

        String responsibilities = informationText(
                input.studentResponsibilities(),
                2000,
                "studentResponsibilities"
        );

        String requiredTools = informationText(
                input.requiredTools(), 1500, "requiredTools"
        );

        Integer score = input.scoringScale();

        if (score != null && (score < 1 || score > 100)) {
            fail(
                    "scoringScale",
                    "Scoring Scale must be between 1 and 100"
            );
        }

        entity.setDescription(description);
        entity.setTeachingMethods(teachingMethods);
        entity.setDegreeLevel(degreeLevel);
        entity.setTimeAllocation(timeAllocation);
        entity.setStudentResponsibilities(responsibilities);
        entity.setRequiredTools(requiredTools);
        entity.setScoringScale(score);

        Syllabus saved = syllabuses.saveAndFlush(entity);

        return queries.toInformationView(saved);
    }


}