package com.example.starter_project_2025.system.demo.learningpath;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.PrerequisiteItem;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePrerequisiteService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.learningpath.LearningPathDTO.*;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A learner's progress is derived, never stored: a course counts as done when the learner holds its certificate
 * (which already encodes the course's completion rule). Once every course is done, a completion record with a
 * code is created exactly once.
 */
@Service
@RequiredArgsConstructor
public class LearningPathService {

    private final LearningPathRepository paths;
    private final LearningPathCourseRepository pathCourses;
    private final LearningPathCompletionRepository completions;
    private final CourseRepository courses;
    private final CertificateRepository certificates;
    private final CourseEnrollmentRepository enrollments;
    private final CoursePrerequisiteService prerequisites;
    private final UserRepository users;

    // ---------- learner side ----------

    @Transactional(readOnly = true)
    public List<PathSummary> list(Long userId) {
        List<PathSummary> result = new ArrayList<>();
        for (LearningPath path : paths.findAllByIsActiveTrueOrderByNameAsc()) {
            List<LearningPathCourse> items = pathCourses.findAllByPathId(path.getId());
            int done = (int) items.stream().filter(pc -> isCourseDone(userId, pc.getCourse().getId())).count();
            result.add(new PathSummary(path.getId(), path.getName(), path.getDescription(), items.size(), done,
                    PathProgressLogic.percent(done, items.size()),
                    PathProgressLogic.isComplete(done, items.size())));
        }
        return result;
    }

    /** Also records the completion the first time the learner has finished every course. */
    @Transactional
    public PathDetail get(Long pathId, Long userId) {
        LearningPath path = find(pathId);
        List<LearningPathCourse> items = pathCourses.findAllByPathId(pathId);
        List<PathCourseItem> rows = new ArrayList<>();
        int done = 0;
        for (LearningPathCourse pc : items) {
            Long courseId = pc.getCourse().getId();
            boolean completed = isCourseDone(userId, courseId);
            List<String> missing = prerequisites.list(courseId, userId).stream()
                    .filter(p -> !p.met()).map(PrerequisiteItem::courseName).toList();
            var status = PathProgressLogic.status(completed,
                    enrollments.existsByUser_IdAndCourse_Id(userId, courseId), missing.isEmpty());
            if (completed) {
                done++;
            }
            rows.add(new PathCourseItem(courseId, pc.getCourse().getName(), pc.getPosition(), status.name(), missing));
        }
        boolean complete = PathProgressLogic.isComplete(done, items.size());
        LearningPathCompletion completion = complete ? recordCompletion(userId, path) : null;
        return new PathDetail(path.getId(), path.getName(), path.getDescription(), rows, done,
                PathProgressLogic.percent(done, items.size()), complete,
                completion == null ? null : completion.getCompletionCode(),
                completion == null ? null : completion.getCompletedAt());
    }

    // ---------- staff side ----------

    @Transactional
    public PathSummary create(PathRequest request) {
        String name = request.name().trim();
        if (paths.existsByNameIgnoreCaseAndIsActiveTrue(name)) {
            throw new BadRequestException("A learning path with this name already exists");
        }
        LearningPath saved = paths.save(LearningPath.builder().name(name).description(clean(request.description())).build());
        return new PathSummary(saved.getId(), saved.getName(), saved.getDescription(), 0, 0, 0, false);
    }

    @Transactional
    public void update(Long pathId, PathRequest request) {
        LearningPath path = find(pathId);
        String name = request.name().trim();
        if (paths.existsByNameIgnoreCaseAndIsActiveTrueAndIdNot(name, pathId)) {
            throw new BadRequestException("A learning path with this name already exists");
        }
        path.setName(name);
        path.setDescription(clean(request.description()));
        paths.save(path);
    }

    /** Soft delete: completions already earned stay intact. */
    @Transactional
    public void delete(Long pathId) {
        LearningPath path = find(pathId);
        path.setIsActive(false);
        paths.save(path);
    }

    @Transactional
    public void setCourses(Long pathId, List<Long> courseIds) {
        LearningPath path = find(pathId);
        PathProgressLogic.validateCourseIds(courseIds);
        List<Course> found = courses.findAllById(courseIds);
        if (found.size() != courseIds.size()) {
            throw new ResourceNotFoundException("One or more courses were not found");
        }
        pathCourses.deleteAllByPathId(pathId);
        pathCourses.flush();
        List<LearningPathCourse> rows = new ArrayList<>();
        for (int i = 0; i < courseIds.size(); i++) {
            Long id = courseIds.get(i);
            Course course = found.stream().filter(c -> c.getId().equals(id)).findFirst().orElseThrow();
            rows.add(LearningPathCourse.builder().path(path).course(course).position(i + 1).build());
        }
        pathCourses.saveAll(rows);
    }

    // ---------- helpers ----------

    private LearningPath find(Long pathId) {
        return paths.findById(pathId)
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Learning path not found"));
    }

    private boolean isCourseDone(Long userId, Long courseId) {
        return certificates.existsByUser_IdAndCourse_Id(userId, courseId);
    }

    private LearningPathCompletion recordCompletion(Long userId, LearningPath path) {
        return completions.findByUser_IdAndPath_Id(userId, path.getId()).orElseGet(() -> {
            User user = users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
            // The unique (user, path) constraint guards against a double completion if two requests ever race.
            return completions.save(LearningPathCompletion.builder()
                    .user(user).path(path)
                    .completionCode("LP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase())
                    .completedAt(LocalDateTime.now()).build());
        });
    }

    private static String clean(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
