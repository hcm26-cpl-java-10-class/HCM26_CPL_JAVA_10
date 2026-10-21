package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusModels.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusService {

    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;

    private static String clean(String raw) {
        return raw == null
                ? ""
                : raw.strip().replaceAll("(?U)\\s+", " ");
    }

    private static String key(String text) {
        return clean(text).toLowerCase(Locale.ROOT);
    }

    private static void fail(String field, String message) {
        throw new BusinessValidationException(
                Map.of(field, List.of(message))
        );
    }

    private static String requiredTitle(
            String raw,
            int max,
            String field
    ) {
        String value = clean(raw);

        if (value.length() < 3
                || value.length() > max
                || value.codePoints().noneMatch(Character::isLetter)) {
            fail(
                    field,
                    "Must contain letters and be 3-" + max
                            + " characters long"
            );
        }

        return value;
    }

    private static int requiredOrder(Integer order) {
        if (order == null || order < 0) {
            fail("orderIndex", "Order must be a non-negative integer");
        }

        return order;
    }

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

    @Transactional(readOnly = true)
    public List<Summary> list(String query) {
        String q = clean(query);

        if (q.length() > 100) {
            fail("search", "Search text is too long");
        }

        return syllabuses.search(q)
                .stream()
                .map(s -> new Summary(
                        s.getId(),
                        s.getCode(),
                        s.getName(),
                        s.getDescription(),
                        sections.countBySyllabus_Id(s.getId()),
                        Boolean.TRUE.equals(s.getIsActive())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public Detail get(Long id) {
        Syllabus s = syllabus(id);

        List<SectionView> content =
                sections.findBySyllabus_IdOrderByOrderIndexAsc(id)
                        .stream()
                        .map(sec -> new SectionView(
                                sec.getId(),
                                sec.getTitle(),
                                sec.getOrderIndex(),
                                topics.findBySection_IdOrderByOrderIndexAsc(
                                                sec.getId()
                                        )
                                        .stream()
                                        .map(t -> new TopicView(
                                                t.getId(),
                                                t.getTitle(),
                                                t.getOrderIndex()
                                        ))
                                        .toList()
                        ))
                        .toList();

        return new Detail(
                s.getId(),
                s.getCode(),
                s.getName(),
                s.getDescription(),
                content,
                Boolean.TRUE.equals(s.getIsActive())
        );
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
        Syllabus entity = syllabus(id);

        fillSyllabus(entity, input);

        syllabuses.saveAndFlush(entity);

        return get(id);
    }

    public void delete(Long id) {
        Syllabus entity = syllabus(id);

        if (sections.countBySyllabus_Id(id) > 0) {
            fail(
                    "sections",
                    "Delete all sections before deleting this syllabus"
            );
        }

        syllabuses.delete(entity);
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

        sections.save(entity);

        return get(syllabusId);
    }

    public Detail updateSection(
            Long syllabusId,
            Long sectionId,
            SectionInput input
    ) {
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

        sections.save(entity);

        return get(syllabusId);
    }

    public Detail bulkCreateSections(
            Long syllabusId,
            BulkSectionInput input
    ) {
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

        return get(syllabusId);
    }

    public void deleteSection(
            Long syllabusId,
            Long sectionId
    ) {
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

        int nextOrder = existing.stream()
                .mapToInt(SyllabusTopic::getOrderIndex)
                .max()
                .orElse(0) + 1;

        SyllabusTopic entity = new SyllabusTopic();

        entity.setSection(parent);
        entity.setTitle(title);
        entity.setOrderIndex(nextOrder);

        topics.save(entity);

        return get(syllabusId);
    }

    public Detail updateTopic(
            Long syllabusId,
            Long sectionId,
            Long topicId,
            TopicInput input
    ) {
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

        entity.setTitle(title);

        topics.save(entity);

        return get(syllabusId);
    }

    public void deleteTopic(
            Long syllabusId,
            Long sectionId,
            Long topicId
    ) {
        SyllabusTopic entity = topic(
                syllabusId,
                sectionId,
                topicId
        );

        topics.delete(entity);
    }

    @Transactional(readOnly = true)
    public ValidationResult validate(Long syllabusId) {
        Detail detail = get(syllabusId);

        List<String> errors = new ArrayList<>();

        if (detail.sections().isEmpty()) {
            errors.add(
                    "Syllabus must have at least one section"
            );
        }

        for (SectionView section : detail.sections()) {
            if (section.topics().isEmpty()) {
                errors.add(
                        "Section '" + section.title()
                                + "' needs at least one topic"
                );
            }
        }

        return new ValidationResult(
                errors.isEmpty(),
                errors
        );
    }

    private static String informationText(
            String raw,
            int maxLength,
            String field
    ) {
        String value = raw == null ? "" : raw.strip();

        if (value.length() > maxLength) {
            fail(field, "Must not exceed " + maxLength + " characters");
        }

        return value;
    }

    private InformationView toInformationView(Syllabus s) {
        return new InformationView(
                s.getId(),
                s.getCode(),
                s.getName(),
                s.getDescription(),
                s.getTeachingMethods(),
                s.getDegreeLevel(),
                s.getTimeAllocation(),
                s.getStudentResponsibilities(),
                s.getRequiredTools(),
                s.getScoringScale()
        );
    }

    @Transactional(readOnly = true)
    public InformationView getInformation(Long syllabusId) {
        return toInformationView(syllabus(syllabusId));
    }

    public InformationView updateInformation(
            Long syllabusId,
            InformationInput input
    ) {
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

        return toInformationView(saved);
    }

}