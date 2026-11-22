package com.example.starter_project_2025.system.exam;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ActiveProfiles("test")
class CourseExamLinkPersistenceTest {

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void linkedExamRemainsInCourseQueryAfterReload() {
        Course course = courseRepository.save(Course.builder()
                .name("Exam link persistence " + UUID.randomUUID())
                .build());

        Exam exam = new Exam();
        exam.setIsActive(true);
        exam.setTitle("Persistent course assessment");
        exam.setDurationMinutes(30);
        exam.setCourse(course);
        Exam savedExam = examRepository.save(exam);

        entityManager.flush();
        entityManager.clear();

        assertTrue(examRepository.findByCourseLink(course.getId(), null, null, false).stream()
                .anyMatch(reloaded -> savedExam.getId().equals(reloaded.getId())));
    }
}
