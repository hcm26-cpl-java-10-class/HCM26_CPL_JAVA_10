package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CertificateServiceImpl
        extends BaseCrudServiceImpl<Certificate, Long, CertificateDTO, CertificateFilter>
        implements CertificateService{

    CertificateRepository certificateRepository;
    CertificateMapper certificateMapper;
    CourseRepository courseRepository;
    UserRepository userRepository;
    LessonRepository lessonRepository;
    LessonProgressRepository lessonProgressRepository;
    CourseEnrollmentRepository courseEnrollmentRepository;
    com.example.starter_project_2025.system.demo.course.CourseAssessmentService assessments;

    @Override
    protected BaseCrudRepository<Certificate, Long> getRepository() {
        return certificateRepository;
    }

    @Override
    protected BaseCrudMapper<Certificate, CertificateDTO> getMapper() {
        return certificateMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"verificationToken"};
    }

    @Override
    protected void beforeCreate(Certificate certificate, CertificateDTO request, ValidationContext ctx) {
        if (request.getCourseId() == null) {
            throw new IllegalArgumentException("Course is required");
        }
        
        if (request.getUserId() == null) {
            throw new IllegalArgumentException("User is required");
        }

        Course course = courseRepository.findById(request.getCourseId())
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Course not found: " + request.getCourseId()
                        )
                );
        
        User user = userRepository.findById(request.getUserId())
                        .orElseThrow(() -> new IllegalArgumentException("User not found"));

        var enrollment=courseEnrollmentRepository.findByUser_IdAndCourse_Id(user.getId(),course.getId())
                .orElseThrow(()->new ResponseStatusException(HttpStatus.CONFLICT,"Student must be enrolled before receiving a certificate"));
        if (!eligible(enrollment)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Complete the course lessons and pass all required course grading checks first");
        certificate.setCourse(course);
        certificate.setUser(user);
    }

    @Transactional
    @Override
    public void issueIfCourseCompleted(CourseEnrollment courseEnrollment) {
        Long userId = courseEnrollment.getUser().getId();
        Long courseId = courseEnrollment.getCourse().getId();

        if (!eligible(courseEnrollment)) return;

        if(certificateRepository.existsByUser_IdAndCourse_Id(userId, courseId)) {
            return;
        }

        Certificate certificate = Certificate.builder()
                .user(courseEnrollment.getUser())
                .course(courseEnrollment.getCourse())
                .build();

        certificateRepository.save(certificate);
    }

    @Transactional(readOnly = true)
    @Override
    public CertificateVerificationDTO verify(UUID verificationToken) {
        Certificate certificate = certificateRepository
                .findByVerificationToken(verificationToken)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Certificate not found"
                ));

        return new CertificateVerificationDTO(
                certificate.getVerificationToken(),
                certificate.getCourse().getName(),
                certificate.getUser().getFullName(),
                certificate.getIssuedAt(),
                currentlyEligible(certificate)
        );
    }

    @Transactional(readOnly = true)
    @Override
    public List<CertificateDTO> getMyCertificates(Long userId) {
        return certificateRepository.findAllByUser_Id(userId)
                .stream()
                .filter(this::currentlyEligible)
                .map(certificateMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    @Override
    public CertificateDTO getByEnrollment(Long enrollmentId) {
        CourseEnrollment enrollment = courseEnrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found"));
        if (!eligible(enrollment)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Course completion requirements have not been met");
        return certificateRepository.findByUser_IdAndCourse_Id(
                        enrollment.getUser().getId(), enrollment.getCourse().getId()
                )
                .map(certificateMapper::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificate not found"));
    }
    private boolean currentlyEligible(Certificate certificate) {
        return courseEnrollmentRepository.findByUser_IdAndCourse_Id(certificate.getUser().getId(),certificate.getCourse().getId())
                .map(this::eligible).orElse(false);
    }
    private boolean eligible(CourseEnrollment enrollment) {
        var active=lessonRepository.findByCourseIdOrdered(enrollment.getCourse().getId()).stream()
                .filter(com.example.starter_project_2025.system.demo.course.CourseAssessmentService::activeLesson).toList();
        var completed=lessonProgressRepository.findAllByEnrollment_Id(enrollment.getId()).stream()
                .filter(LessonProgress::isCompleted).map(p->p.getLesson().getId()).toList();
        return !active.isEmpty() && active.stream().allMatch(l->completed.contains(l.getId()))
                && assessments.canComplete(enrollment.getCourse().getId(),enrollment.getUser().getId());
    }

}
