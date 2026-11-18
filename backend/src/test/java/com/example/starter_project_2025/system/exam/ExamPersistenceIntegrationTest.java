package com.example.starter_project_2025.system.exam;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.service.ExamServiceImpl;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@SpringBootTest
@Transactional
public class ExamPersistenceIntegrationTest {

    @Autowired
    private ExamServiceImpl examService;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private LessonRepository lessonRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private User teacherUser;
    private Course course;
    private Section section;
    private Lesson lesson;

    @BeforeEach
    void setUp() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseGet(() -> {
            Role r = Role.builder().name("TEACHER").build();
            return roleRepository.save(r);
        });

        teacherUser = userRepository.findByEmail("persistence_teacher@example.com").orElseGet(() -> {
            User u = User.builder()
                    .email("persistence_teacher@example.com")
                    .firstName("Persistence")
                    .lastName("Teacher")
                    .passwordHash("hashed")
                    .roles(Set.of(teacherRole))
                    .isActive(true)
                    .isGuest(false)
                    .locked(false)
                    .build();
            return userRepository.save(u);
        });

        UserPrincipal principal = new UserPrincipal(teacherUser, List.of(
                new SimpleGrantedAuthority("EXAM_CREATE"),
                new SimpleGrantedAuthority("EXAM_READ"),
                new SimpleGrantedAuthority("EXAM_UPDATE"),
                new SimpleGrantedAuthority("ROLE_TEACHER")
        ));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );

        course = courseRepository.save(Course.builder()
                .name("Spring Boot for Persistence Testing")
                .instructorUser(teacherUser)
                .build());

        section = sectionRepository.save(Section.builder()
                .title("Build a REST API Section")
                .course(course)
                .orderIndex(1)
                .build());

        lesson = lessonRepository.save(Lesson.builder()
                .title("Controllers and DTOs Lesson")
                .contentType(LessonContentType.TEXT)
                .section(section)
                .orderIndex(1)
                .build());
    }

    @Test
    @DisplayName("Should persist and return courseId, sectionId, lessonId on getById and JSON serialization")
    void createUpdateAndGetExamPersistence() throws Exception {
        // 1. Create an Exam with Course, Section, Lesson
        ExamDTO createReq = new ExamDTO();
        createReq.setTitle("Midterm Java Exam");
        createReq.setDurationMinutes(60);
        createReq.setMaxAttempts(1);
        createReq.setCategory(ExamCategory.ASSIGNMENT);
        createReq.setExamType(ExamType.MIXED);
        createReq.setCourseId(course.getId());
        createReq.setSectionId(section.getId());
        createReq.setLessonId(lesson.getId());

        ExamDTO created = examService.create(createReq);
        assertNotNull(created.getId());
        assertEquals(course.getId(), created.getCourseId());
        assertEquals(section.getId(), created.getSectionId());
        assertEquals(lesson.getId(), created.getLessonId());

        // 2. Fetch using getById
        ExamDTO fetched = examService.getById(created.getId());
        assertNotNull(fetched);
        assertEquals(course.getId(), fetched.getCourseId());
        assertEquals(section.getId(), fetched.getSectionId());
        assertEquals(lesson.getId(), fetched.getLessonId());
        assertEquals(course.getName(), fetched.getCourseName());
        assertEquals(section.getTitle(), fetched.getSectionTitle());
        assertEquals(lesson.getTitle(), fetched.getLessonTitle());

        // 3. Verify JSON serialization sends courseId, sectionId, lessonId
        String json = objectMapper.writeValueAsString(fetched);
        JsonNode jsonNode = objectMapper.readTree(json);
        assertTrue(jsonNode.has("courseId"), "JSON must contain courseId");
        assertEquals(course.getId().longValue(), jsonNode.get("courseId").asLong());
        assertTrue(jsonNode.has("sectionId"), "JSON must contain sectionId");
        assertEquals(section.getId().longValue(), jsonNode.get("sectionId").asLong());
        assertTrue(jsonNode.has("lessonId"), "JSON must contain lessonId");
        assertEquals(lesson.getId().longValue(), jsonNode.get("lessonId").asLong());

        // 4. Update the exam to section-level (clear lesson)
        ExamDTO updateReq = new ExamDTO();
        updateReq.setTitle("Midterm Java Exam Updated");
        updateReq.setDurationMinutes(90);
        updateReq.setMaxAttempts(2);
        updateReq.setCategory(ExamCategory.FINAL_TEST);
        updateReq.setExamType(ExamType.MIXED);
        updateReq.setCourseId(course.getId());
        updateReq.setSectionId(section.getId());
        updateReq.setLessonId(null); // clear lesson

        ExamDTO updated = examService.update(created.getId(), updateReq);
        assertEquals(course.getId(), updated.getCourseId());
        assertEquals(section.getId(), updated.getSectionId());
        assertNull(updated.getLessonId());

        // 5. Fetch again using getById
        ExamDTO fetchedAfterUpdate = examService.getById(created.getId());
        assertEquals(course.getId(), fetchedAfterUpdate.getCourseId());
        assertEquals(section.getId(), fetchedAfterUpdate.getSectionId());
        assertNull(fetchedAfterUpdate.getLessonId());

        // 6. Completely unlink exam (courseId = null, sectionId = null, lessonId = null)
        ExamDTO unlinkReq = new ExamDTO();
        unlinkReq.setTitle("Midterm Java Exam Standalone");
        unlinkReq.setDurationMinutes(90);
        unlinkReq.setMaxAttempts(2);
        unlinkReq.setCategory(ExamCategory.FINAL_TEST);
        unlinkReq.setExamType(ExamType.MIXED);
        unlinkReq.setCourseId(null);
        unlinkReq.setSectionId(null);
        unlinkReq.setLessonId(null);

        ExamDTO unlinked = examService.update(created.getId(), unlinkReq);
        assertNull(unlinked.getCourseId());
        assertNull(unlinked.getSectionId());
        assertNull(unlinked.getLessonId());

        ExamDTO fetchedAfterUnlink = examService.getById(created.getId());
        assertNull(fetchedAfterUnlink.getCourseId());
        assertNull(fetchedAfterUnlink.getSectionId());
        assertNull(fetchedAfterUnlink.getLessonId());
    }
}
