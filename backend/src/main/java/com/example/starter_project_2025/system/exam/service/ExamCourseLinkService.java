package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.CourseExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.dto.ExamLinkOptionDTO;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * Gan bai thi vao course / section / lesson va doc bai thi theo course.
 * <ul>
 *   <li>Lien ket la tuy chon; chon lesson thi section va course duoc suy ra, phai nhat quan.</li>
 *   <li>Giao vien (khong phai ADMIN) chi gan duoc vao course ma minh la giang vien (instructorUser).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ExamCourseLinkService {

    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final ExamAccessGuard examAccessGuard;

    // ------------------------------------------------------------------ gan lien ket khi tao / sua bai thi

    /**
     * Ap lien ket course/section/lesson tu request len de thi. Neu request khong gui truong nao thi giu nguyen;
     * gui gia tri null (ca ba) nghia la go lien ket.
     */
    public void apply(Exam exam, ExamDTO request, ValidationContext ctx) {
        if (!request.isCourseLinkProvided()) {
            return;
        }
        Long courseId = request.getCourseId();
        Long sectionId = request.getSectionId();
        Long lessonId = request.getLessonId();

        Course course = null;
        Section section = null;
        Lesson lesson = null;

        if (lessonId != null) {
            lesson = lessonRepository.findById(lessonId).orElse(null);
            if (lesson == null) {
                throw new ResourceNotFoundException("Lesson not found");
            }
            section = lesson.getSection();
            course = section.getCourse();
        } else if (sectionId != null) {
            section = sectionRepository.findById(sectionId).orElse(null);
            if (section == null) {
                throw new ResourceNotFoundException("Section not found");
            }
            course = section.getCourse();
        } else if (courseId != null) {
            course = courseRepository.findById(courseId).orElse(null);
            if (course == null) {
                throw new ResourceNotFoundException("Course not found");
            }
        }

        if (lesson != null && sectionId != null && !sectionId.equals(section.getId())) {
            ctx.add("sectionId", "The selected lesson does not belong to the selected section");
        }
        if (section != null && courseId != null && !courseId.equals(course.getId())) {
            ctx.add("courseId", "The selected section/lesson does not belong to the selected course");
        }
        if (ctx.hasErrors()) {
            return;
        }

        Long currentCourseId = exam.getCourse() == null ? null : exam.getCourse().getId();
        if (course != null && !Objects.equals(course.getId(), currentCourseId)) {
            checkCanLink(course);
        }
        exam.setCourse(course);
        exam.setSection(section);
        exam.setLesson(lesson);
    }

    /** Giao vien chi duoc gan bai thi vao course cua minh; ADMIN va vai tro khac khong bi gioi han. */
    private void checkCanLink(Course course) {
        Long scopeUserId = ownerScopeUserId();
        if (scopeUserId != null && !isInstructor(course, scopeUserId)) {
            throw new AccessDeniedException("You can only attach assessments to courses you teach");
        }
    }

    // ------------------------------------------------------------------ doc bai thi theo course

    @Transactional(readOnly = true)
    public List<CourseExamDTO> listByCourse(Long courseId, Long sectionId, Long lessonId, UserPrincipal principal) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        boolean staff = examAccessGuard.isAdmin(principal) || isInstructor(course, userId);
        if (!staff) {
            boolean enrolled = userId != null && enrollmentRepository.existsByUser_IdAndCourse_Id(userId, courseId);
            if (!enrolled) {
                throw new AccessDeniedException("You do not have access to this course");
            }
        }
        return examRepository.findByCourseLink(courseId, sectionId, lessonId, !staff).stream()
                .map(e -> toCourseExam(e, staff))
                .toList();
    }

    private CourseExamDTO toCourseExam(Exam e, boolean staff) {
        return new CourseExamDTO(
                e.getId(),
                e.getTitle(),
                e.getCategory(),
                ExamTypePolicy.effective(e.getExamType()),
                e.getDurationMinutes(),
                e.getMaxAttempts(),
                ExamScoring.effectiveMax(e.getMaxScore()),
                e.getPassScore(),
                e.getIsActive(),
                e.getCourse() == null ? null : e.getCourse().getId(),
                e.getSection() == null ? null : e.getSection().getId(),
                e.getSection() == null ? null : e.getSection().getTitle(),
                e.getLesson() == null ? null : e.getLesson().getId(),
                e.getLesson() == null ? null : e.getLesson().getTitle(),
                staff && e.getQuestions() != null ? e.getQuestions().size() : null,
                staff ? creatorName(e.getCreatedBy()) : null);
    }

    private String creatorName(Long userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId)
                .map(u -> u.getFullName() == null || u.getFullName().isBlank() ? u.getEmail() : u.getFullName().trim())
                .orElse(null);
    }

    // ------------------------------------------------------------------ lua chon cho o chon trong form

    /** Course ma nguoi dung duoc phep gan bai thi vao (giao vien: course cua minh; admin: tat ca). */
    @Transactional(readOnly = true)
    public List<ExamLinkOptionDTO> courseOptions() {
        Long scopeUserId = ownerScopeUserId();
        return courseRepository.findAll().stream()
                .filter(c -> scopeUserId == null || isInstructor(c, scopeUserId))
                .map(c -> new ExamLinkOptionDTO(c.getId(), c.getName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExamLinkOptionDTO> sectionOptions(Long courseId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        checkCanLink(course);
        return sectionRepository.findByCourse_IdOrderByOrderIndexAsc(courseId).stream()
                .map(s -> new ExamLinkOptionDTO(s.getId(), s.getTitle()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExamLinkOptionDTO> lessonOptions(Long sectionId) {
        Section section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Section not found"));
        checkCanLink(section.getCourse());
        return lessonRepository.findBySection_IdOrderByOrderIndexAsc(sectionId).stream()
                .map(l -> new ExamLinkOptionDTO(l.getId(), l.getTitle()))
                .toList();
    }

    // ------------------------------------------------------------------ tien ich

    private boolean isInstructor(Course course, Long userId) {
        return userId != null
                && course.getInstructorUser() != null
                && userId.equals(course.getInstructorUser().getId());
    }

    private Long ownerScopeUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal
                && examAccessGuard.isOwnerScoped(principal)) {
            return principal.getUser().getId();
        }
        return null;
    }
}
