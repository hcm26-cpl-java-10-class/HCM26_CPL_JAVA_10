package com.example.starter_project_2025.system.demo.coursepolicy;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.PrerequisiteItem;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * A learner has "completed" a prerequisite when they hold its certificate, because the certificate is only
 * issued once the completion rule of that course is satisfied.
 */
@Service
@RequiredArgsConstructor
public class CoursePrerequisiteService {

    static final int MAX_PREREQUISITES = 5;

    private final CoursePrerequisiteRepository repository;
    private final CertificateRepository certificateRepository;
    private final CourseRepository courseRepository;

    @Transactional(readOnly = true)
    public List<PrerequisiteItem> list(Long courseId, Long userId) {
        return repository.findAllByCourseId(courseId).stream()
                .map(p -> new PrerequisiteItem(
                        p.getPrerequisite().getId(),
                        p.getPrerequisite().getName(),
                        userId != null && certificateRepository.existsByUser_IdAndCourse_Id(userId, p.getPrerequisite().getId())))
                .toList();
    }

    @Transactional
    public List<PrerequisiteItem> add(Long courseId, Long prerequisiteCourseId) {
        var course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        var prerequisite = courseRepository.findById(prerequisiteCourseId)
                .orElseThrow(() -> new ResourceNotFoundException("Prerequisite course not found"));
        if (courseId.equals(prerequisiteCourseId)) {
            throw new BadRequestException("A course cannot be its own prerequisite");
        }
        if (repository.findByCourse_IdAndPrerequisite_Id(courseId, prerequisiteCourseId).isPresent()) {
            throw new BadRequestException("This prerequisite is already added");
        }
        if (repository.countByCourse_Id(courseId) >= MAX_PREREQUISITES) {
            throw new BadRequestException("A course can have at most " + MAX_PREREQUISITES + " prerequisites");
        }
        if (CompletionRuleLogic.createsCycle(courseId, prerequisiteCourseId, graph())) {
            throw new BadRequestException(
                    "This would create a loop: \"" + prerequisite.getName() + "\" already depends on \"" + course.getName() + "\"");
        }
        repository.save(CoursePrerequisite.builder().course(course).prerequisite(prerequisite).build());
        return list(courseId, null);
    }

    @Transactional
    public void remove(Long courseId, Long prerequisiteCourseId) {
        CoursePrerequisite found = repository.findByCourse_IdAndPrerequisite_Id(courseId, prerequisiteCourseId)
                .orElseThrow(() -> new ResourceNotFoundException("Prerequisite not found"));
        repository.delete(found);
    }

    /** Throws 400 naming the courses the learner still has to complete. */
    @Transactional(readOnly = true)
    public void assertMet(Long userId, Long courseId) {
        List<String> missing = list(courseId, userId).stream()
                .filter(item -> !item.met())
                .map(PrerequisiteItem::courseName)
                .toList();
        if (!missing.isEmpty()) {
            throw new BadRequestException("Complete these courses first: " + String.join(", ", missing));
        }
    }

    private Map<Long, Set<Long>> graph() {
        Map<Long, Set<Long>> graph = new HashMap<>();
        for (Object[] edge : repository.findAllEdges()) {
            graph.computeIfAbsent((Long) edge[0], k -> new HashSet<>()).add((Long) edge[1]);
        }
        return graph;
    }
}
