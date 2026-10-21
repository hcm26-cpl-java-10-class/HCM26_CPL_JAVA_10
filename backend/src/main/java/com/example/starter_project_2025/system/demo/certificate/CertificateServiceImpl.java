package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
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
        return new String[]{"name", "description"};
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

        certificate.setCourse(course);
        certificate.setUser(user);
    }

    @Override
    @Transactional
    public void issueIfCourseCompleted(CourseEnrollment courseEnrollment) {
        Long userId = courseEnrollment.getUser().getId();
        Long courseId = courseEnrollment.getCourse().getId();

        if(certificateRepository.existByUser_IdAndCourse_Id(userId, courseId)) {
            return;
        }

        List<Lesson> lessons = lessonRepository.findByCourseIdOrdered(courseId);

        if(lessons.isEmpty()) {
            return;
        }

        Set<Long> completedLessonIds = lessonProgressRepository
                .findAllByEnrollment_Id(courseEnrollment.getId())
                .stream()
                .filter(LessonProgress::isCompleted)
                .map(progress -> progress.getLesson().getId())
                .collect(Collectors.toSet());

        boolean allCompleted = lessons.stream()
                .allMatch(lesson -> completedLessonIds.contains(lesson.getId()));

        if (!allCompleted) {
            return;
        }
        Certificate certificate = Certificate.builder()
                .user(courseEnrollment.getUser())
                .course(courseEnrollment.getCourse())
                .build();

        certificateRepository.save(certificate);
    }
}
