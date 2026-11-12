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
import java.util.Map;
import java.util.Objects;

/**
 * Gan bai thi vao course / section / lesson va doc bai thi theo course / section / lesson.
 * <ul>
 *   <li>Lien ket la tuy chon; chon lesson thi section va course duoc suy ra, phai nhat quan.</li>
 *   <li>Giao vien (khong phai ADMIN) chi gan duoc vao course ma minh la giang vien (instructorUser).</li>
 *   <li>Giao vien chi duoc quan ly / lien ket bai thi do chinh minh tao (Exam Owner).</li>
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
    private final ExamProgressLockService lockService;

    // ------------------------------------------------------------------ gan lien ket khi tao / sua bai thi

    /**
     * Ap lien ket course/section/lesson tu request len de thi. Neu request khong gui truong nao thi giu nguyen;
     * gui gia tri null (ca ba) nghia la go lien ket.
     */
    public void apply(Exam exam, ExamDTO request, ValidationContext ctx) {
        if (!request.isCourseLinkProvided()) {
            validateLessonCategory(exam.getLesson(),request.getCategory()!=null?request.getCategory():exam.getCategory(),ctx);
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
            course = section != null ? section.getCourse() : null;
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

        if (lesson != null && sectionId != null && (section == null || !sectionId.equals(section.getId()))) {
            ctx.add("sectionId", "The selected lesson does not belong to the selected section");
        }
        if (section != null && courseId != null && (course == null || !courseId.equals(course.getId()))) {
            ctx.add("courseId", "The selected section/lesson does not belong to the selected course");
        }
        validateLessonCategory(lesson,request.getCategory()!=null?request.getCategory():exam.getCategory(),ctx);
        if (ctx.hasErrors()) { return; }

        Long currentCourseId = exam.getCourse() == null ? null : exam.getCourse().getId();
        if (course != null && !Objects.equals(course.getId(), currentCourseId)) {
            checkCanLink(course);
        }
        exam.setCourse(course);
        exam.setSection(section);
        exam.setLesson(lesson);
    }

    /** Giao vien chi duoc gan bai thi vao course cua minh; ADMIN va vai tro khac khong bi gioi han. */
    private void checkCanLink(Course course, UserPrincipal principal) {
        if (principal != null) {
            if (examAccessGuard.isOwnerScoped(principal)) {
                Long userId = principal.getUser() == null ? null : principal.getUser().getId();
                if (!isInstructor(course, userId)) {
                    throw new AccessDeniedException("You can only attach assessments to courses you teach");
                }
            }
        } else {
            Long scopeUserId = ownerScopeUserId();
            if (scopeUserId != null && !isInstructor(course, scopeUserId)) {
                throw new AccessDeniedException("You can only attach assessments to courses you teach");
            }
        }
    }

    private void checkCanLink(Course course) {
        checkCanLink(course, null);
    }

    // ------------------------------------------------------------------ kiem tra quyen truy cap khoa hoc

    public boolean checkCourseAccess(Course course, UserPrincipal principal) {
        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        boolean staff = examAccessGuard.isAdmin(principal) || isInstructor(course, userId);
        if (!staff) {
            boolean enrolled = userId != null && enrollmentRepository.existsByUser_IdAndCourse_Id(userId, course.getId());
            if (!enrolled) {
                throw new AccessDeniedException("You do not have access to this course");
            }
        }
        return staff;
    }

    // ------------------------------------------------------------------ doc bai thi theo course / section / lesson

    @Transactional(readOnly = true)
    public List<CourseExamDTO> listByCourse(Long courseId, Long sectionId, Long lessonId, UserPrincipal principal) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        boolean staff = checkCourseAccess(course, principal);
        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        List<Exam> exams = examRepository.findByCourseLink(courseId, sectionId, lessonId, !staff);
        Map<Long, ExamProgressLockService.LockState> locks =
                staff ? Map.of() : lockService.evaluateAll(exams, userId, courseId);
        return exams.stream()
                .map(e -> toCourseExam(e, staff,
                        locks.getOrDefault(e.getId(), ExamProgressLockService.LockState.OPEN)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CourseExamDTO> listBySection(Long sectionId, UserPrincipal principal) {
        Section section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Section not found"));
        Course course = section.getCourse();
        if (course == null) {
            throw new ResourceNotFoundException("Course not found");
        }
        boolean staff = checkCourseAccess(course, principal);
        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        List<Exam> exams = examRepository.findByCourseLink(course.getId(), sectionId, null, !staff);
        Map<Long, ExamProgressLockService.LockState> locks =
                staff ? Map.of() : lockService.evaluateAll(exams, userId, course.getId());
        return exams.stream()
                .map(e -> toCourseExam(e, staff,
                        locks.getOrDefault(e.getId(), ExamProgressLockService.LockState.OPEN)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CourseExamDTO> listByLesson(Long lessonId, UserPrincipal principal) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson not found"));
        Section section = lesson.getSection();
        if (section == null) {
            throw new ResourceNotFoundException("Section not found");
        }
        Course course = section.getCourse();
        if (course == null) {
            throw new ResourceNotFoundException("Course not found");
        }
        boolean staff = checkCourseAccess(course, principal);
        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        List<Exam> exams = examRepository.findByCourseLink(course.getId(), section.getId(), lessonId, !staff);
        Map<Long, ExamProgressLockService.LockState> locks =
                staff ? Map.of() : lockService.evaluateAll(exams, userId, course.getId());
        return exams.stream()
                .map(e -> toCourseExam(e, staff,
                        locks.getOrDefault(e.getId(), ExamProgressLockService.LockState.OPEN)))
                .toList();
    }

    @Transactional
    public CourseExamDTO linkExam(Long courseId, Long examId, Long sectionId, Long lessonId, UserPrincipal principal) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        checkCanLink(course, principal);

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));

        if (!examAccessGuard.canManage(exam, principal)) {
            throw new AccessDeniedException("You do not have permission to manage this exam");
        }

        Section section = null;
        Lesson lesson = null;

        if (lessonId != null) {
            lesson = lessonRepository.findById(lessonId)
                    .orElseThrow(() -> new ResourceNotFoundException("Lesson not found"));
            section = lesson.getSection();
            if (section == null || section.getCourse() == null || !course.getId().equals(section.getCourse().getId())) {
                throw new IllegalArgumentException("Lesson does not belong to this course");
            }
            if (sectionId != null && !sectionId.equals(section.getId())) {
                throw new IllegalArgumentException("Lesson does not belong to the selected section");
            }
        } else if (sectionId != null) {
            section = sectionRepository.findById(sectionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Section not found"));
            if (section.getCourse() == null || !course.getId().equals(section.getCourse().getId())) {
                throw new IllegalArgumentException("Section does not belong to this course");
            }
        }

        exam.setCourse(course);
        exam.setSection(section);
        exam.setLesson(lesson);
        ValidationContext weightContext = new ValidationContext();
        validateLessonCategory(lesson,exam.getCategory(),weightContext);
        validateWeight(exam, exam.getCourseWeight(), weightContext);
        weightContext.throwIfErrors();
        examRepository.save(exam);

        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        boolean staff = examAccessGuard.isAdmin(principal) || isInstructor(course, userId);
        return toCourseExam(exam, staff);
    }

    @Transactional
    public void unlinkExam(Long courseId, Long examId, boolean unlinkFromCourse, UserPrincipal principal) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        checkCanLink(course, principal);

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));

        if (!examAccessGuard.canManage(exam, principal)) {
            throw new AccessDeniedException("You do not have permission to manage this exam");
        }

        if (exam.getCourse() != null && !courseId.equals(exam.getCourse().getId())) {
            throw new IllegalArgumentException("Exam is not linked to this course");
        }

        if (unlinkFromCourse) {
            exam.setCourse(null);
            exam.setSection(null);
            exam.setLesson(null);
        } else {
            exam.setSection(null);
            exam.setLesson(null);
        }
        examRepository.save(exam);
    }

    @Transactional(readOnly = true)
    public List<CourseExamDTO> availableExams(Long courseId, UserPrincipal principal) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        checkCanLink(course, principal);

        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        boolean isAdmin = examAccessGuard.isAdmin(principal);

        return examRepository.findAll().stream()
                .filter(e -> isAdmin || (userId != null && userId.equals(e.getCreatedBy())))
                .filter(e -> e.getCourse() == null || courseId.equals(e.getCourse().getId()))
                .map(e -> toCourseExam(e, true))
                .toList();
    }

    private CourseExamDTO toCourseExam(Exam e, boolean staff) {
        return toCourseExam(e, staff, ExamProgressLockService.LockState.OPEN);
    }

    private CourseExamDTO toCourseExam(Exam e, boolean staff, ExamProgressLockService.LockState lock) {
        return new CourseExamDTO(
                e.getId(),
                e.getTitle(),
                e.getCategory(),
                ExamTypePolicy.effective(e.getExamType()),
                e.getDurationMinutes(),
                e.getMaxAttempts(),
                ExamScoring.effectiveMax(e.getMaxScore()),
                e.getPassScore(),
                e.getCourseWeight(),
                e.getIsActive(),
                e.getCourse() == null ? null : e.getCourse().getId(),
                e.getSection() == null ? null : e.getSection().getId(),
                e.getSection() == null ? null : e.getSection().getTitle(),
                e.getLesson() == null ? null : e.getLesson().getId(),
                e.getLesson() == null ? null : e.getLesson().getTitle(),
                staff && e.getQuestions() != null ? e.getQuestions().size() : null,
                staff ? creatorName(e.getCreatedBy()) : null,
                lock.locked(),
                lock.reason());
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

    /** A course plan may be incomplete while being built, but cannot allocate over 100%. */
    public void validateWeight(Exam exam, java.math.BigDecimal weight, ValidationContext ctx) {
        if (weight == null) return;
        if (weight.signum()<0 || weight.compareTo(java.math.BigDecimal.valueOf(100))>0
                || weight.stripTrailingZeros().scale()>2) {
            ctx.add("courseWeight", "Course weight must be 0–100 with at most two decimal places");
            return;
        }
        if (exam.getCourse()==null) return;
        Long courseId=exam.getCourse().getId();
        courseRepository.findLockedForAssessment(courseId);
        java.math.BigDecimal others=examRepository.findByCourseLink(courseId,null,null,false).stream()
                .filter(other -> exam.getId()==null || !exam.getId().equals(other.getId()))
                .map(Exam::getCourseWeight).filter(java.util.Objects::nonNull)
                .reduce(java.math.BigDecimal.ZERO,java.math.BigDecimal::add);
        if (others.add(weight).compareTo(java.math.BigDecimal.valueOf(100))>0)
            ctx.add("courseWeight", "Course assessment weights would exceed 100%. Other assessments use " + others + "%");
    }

    private void validateLessonCategory(Lesson lesson,com.example.starter_project_2025.system.exam.domain.ExamCategory category,ValidationContext ctx) {
        if (lesson==null || !com.example.starter_project_2025.system.demo.course.CourseAssessmentService.isAssessment(lesson)) return;
        Exam candidate=new Exam();candidate.setCategory(category);
        if (!com.example.starter_project_2025.system.demo.course.CourseAssessmentService.matches(lesson,candidate))
            ctx.add("lessonId","Assessment category must match the linked lesson type");
    }

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
