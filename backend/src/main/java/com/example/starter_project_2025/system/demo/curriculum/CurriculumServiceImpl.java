package com.example.starter_project_2025.system.demo.curriculum;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.curriculum.CurriculumReorderRequest.LessonOrder;
import com.example.starter_project_2025.system.demo.curriculum.CurriculumReorderRequest.SectionOrder;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class CurriculumServiceImpl implements CurriculumService {

    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final CurriculumValidator curriculumValidator;

    @Override
    @Transactional(readOnly = true)
    public CurriculumTreeDTO getTree(Long courseId) {
        Course course = findCourse(courseId);
        List<Section> sections = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(courseId);
        List<Lesson> lessons = lessonRepository.findByCourseIdOrdered(courseId);
        return buildTree(course, sections, lessons);
    }

    @Override
    @Transactional(readOnly = true)
    public CurriculumValidationResult validatePublish(Long courseId) {
        findCourse(courseId);
        return curriculumValidator.validatePublish(courseId);
    }

    @Override
    public CurriculumTreeDTO reorder(Long courseId, CurriculumReorderRequest request) {
        Course course = findCourse(courseId);

        List<SectionOrder> sectionOrders = request == null || request.sections() == null
                ? List.of() : request.sections();
        List<LessonOrder> lessonOrders = request == null || request.lessons() == null
                ? List.of() : request.lessons();

        ValidationContext ctx = new ValidationContext();
        if (sectionOrders.isEmpty() && lessonOrders.isEmpty()) {
            ctx.add("request", "Nothing to reorder: provide sections and/or lessons");
            ctx.throwIfErrors();
        }

        List<Section> sections = new ArrayList<>(sectionRepository.findByCourse_IdOrderByOrderIndexAsc(courseId));
        List<Lesson> lessons = new ArrayList<>(lessonRepository.findByCourseIdOrdered(courseId));

        Map<Long, Section> sectionById = new HashMap<>();
        sections.forEach(section -> sectionById.put(section.getId(), section));
        Map<Long, Lesson> lessonById = new HashMap<>();
        lessons.forEach(lesson -> lessonById.put(lesson.getId(), lesson));

        Map<Long, Integer> sectionIndex = new HashMap<>();
        sections.forEach(section -> sectionIndex.put(section.getId(), section.getOrderIndex()));
        Set<Long> movedSections = new HashSet<>();

        Map<Long, Integer> lessonIndex = new HashMap<>();
        Map<Long, Section> lessonTarget = new HashMap<>();
        lessons.forEach(lesson -> {
            lessonIndex.put(lesson.getId(), lesson.getOrderIndex());
            lessonTarget.put(lesson.getId(), lesson.getSection());
        });
        Set<Long> movedLessons = new HashSet<>();

        // ---- validate + áp payload (sections)
        Set<Integer> usedSectionIndexes = new HashSet<>();
        for (int i = 0; i < sectionOrders.size(); i++) {
            SectionOrder order = sectionOrders.get(i);
            String field = "sections[" + i + "]";
            if (order == null || order.id() == null || order.orderIndex() == null) {
                ctx.add(field, "Section id and order index are required");
                continue;
            }
            if (!sectionById.containsKey(order.id())) {
                ctx.add(field + ".id", "Section " + order.id() + " does not belong to this course");
                continue;
            }
            if (!movedSections.add(order.id())) {
                ctx.add(field + ".id", "Duplicate section " + order.id() + " in request");
                continue;
            }
            if (!usedSectionIndexes.add(order.orderIndex())) {
                ctx.add(field + ".orderIndex", "Duplicate section order index " + order.orderIndex());
                continue;
            }
            sectionIndex.put(order.id(), order.orderIndex());
        }

        // ---- validate + áp payload (lessons)
        Map<Long, Set<Integer>> usedLessonIndexes = new HashMap<>();
        Set<Long> seenLessons = new HashSet<>();
        for (int i = 0; i < lessonOrders.size(); i++) {
            LessonOrder order = lessonOrders.get(i);
            String field = "lessons[" + i + "]";
            if (order == null || order.id() == null || order.orderIndex() == null) {
                ctx.add(field, "Lesson id and order index are required");
                continue;
            }
            Lesson lesson = lessonById.get(order.id());
            if (lesson == null) {
                ctx.add(field + ".id", "Lesson " + order.id() + " does not belong to this course");
                continue;
            }
            if (!seenLessons.add(order.id())) {
                ctx.add(field + ".id", "Duplicate lesson " + order.id() + " in request");
                continue;
            }
            Section target = order.sectionId() == null
                    ? lesson.getSection()
                    : sectionById.get(order.sectionId());
            if (target == null) {
                ctx.add(field + ".sectionId",
                        "Section " + order.sectionId() + " does not belong to this course");
                continue;
            }
            if (!usedLessonIndexes.computeIfAbsent(target.getId(), key -> new HashSet<>())
                    .add(order.orderIndex())) {
                ctx.add(field + ".orderIndex", "Duplicate lesson order index " + order.orderIndex()
                        + " in section " + target.getId());
                continue;
            }
            movedLessons.add(order.id());
            lessonIndex.put(order.id(), order.orderIndex());
            lessonTarget.put(order.id(), target);
        }

        ctx.throwIfErrors();

        // ---- sắp xếp lại + chuẩn hóa 0..n-1
        sections.sort(Comparator
                .comparing((Section section) -> sectionIndex.get(section.getId()))
                .thenComparing(section -> movedSections.contains(section.getId()) ? 0 : 1)
                .thenComparing(Section::getId));
        for (int i = 0; i < sections.size(); i++) {
            Section section = sections.get(i);
            if (!Integer.valueOf(i).equals(section.getOrderIndex())) {
                section.setOrderIndex(i);
            }
        }

        Map<Long, List<Lesson>> lessonsBySection = new LinkedHashMap<>();
        sections.forEach(section -> lessonsBySection.put(section.getId(), new ArrayList<>()));
        for (Lesson lesson : lessons) {
            lessonsBySection.get(lessonTarget.get(lesson.getId()).getId()).add(lesson);
        }
        for (Map.Entry<Long, List<Lesson>> entry : lessonsBySection.entrySet()) {
            Section section = sectionById.get(entry.getKey());
            List<Lesson> group = entry.getValue();
            group.sort(Comparator
                    .comparing((Lesson lesson) -> lessonIndex.get(lesson.getId()))
                    .thenComparing(lesson -> movedLessons.contains(lesson.getId()) ? 0 : 1)
                    .thenComparing(Lesson::getId));
            for (int i = 0; i < group.size(); i++) {
                Lesson lesson = group.get(i);
                if (lesson.getSection() == null || !section.getId().equals(lesson.getSection().getId())) {
                    lesson.setSection(section);
                }
                if (!Integer.valueOf(i).equals(lesson.getOrderIndex())) {
                    lesson.setOrderIndex(i);
                }
            }
        }

        sectionRepository.saveAll(sections);
        lessonRepository.saveAll(lessons);

        return buildTree(course, sections, lessons);
    }

    private Course findCourse(Long courseId) {
        return courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
    }

    private CurriculumTreeDTO buildTree(Course course, List<Section> sections, List<Lesson> lessons) {
        List<Section> sortedSections = new ArrayList<>(sections);
        sortedSections.sort(Comparator
                .comparing(Section::getOrderIndex)
                .thenComparing(Section::getId));

        Map<Long, List<Lesson>> lessonsBySection = new HashMap<>();
        for (Lesson lesson : lessons) {
            lessonsBySection
                    .computeIfAbsent(lesson.getSection().getId(), key -> new ArrayList<>())
                    .add(lesson);
        }

        List<CurriculumTreeDTO.SectionNode> sectionNodes = new ArrayList<>();
        for (Section section : sortedSections) {
            List<Lesson> sectionLessons = lessonsBySection.getOrDefault(section.getId(), new ArrayList<>());
            sectionLessons.sort(Comparator
                    .comparing(Lesson::getOrderIndex)
                    .thenComparing(Lesson::getId));

            List<CurriculumTreeDTO.LessonNode> lessonNodes = sectionLessons.stream()
                    .map(lesson -> new CurriculumTreeDTO.LessonNode(
                            lesson.getId(),
                            section.getId(),
                            lesson.getTitle(),
                            lesson.getContentType(),
                            lesson.getContentUrl(),
                            lesson.getTextContent(),
                            lesson.getDuration(),
                            lesson.getOrderIndex(),
                            lesson.getIsActive()))
                    .toList();

            sectionNodes.add(new CurriculumTreeDTO.SectionNode(
                    section.getId(),
                    section.getTitle(),
                    section.getOrderIndex(),
                    section.getIsActive(),
                    lessonNodes));
        }

        return new CurriculumTreeDTO(course.getId(), course.getName(), course.getStatus(), sectionNodes);
    }
}