package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.service.ExamServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.web.server.ResponseStatusException;
import javax.sql.DataSource;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(AssessmentLessonControllerTest.Config.class)
class AssessmentLessonControllerTest {
    @Configuration @EnableTransactionManagement(proxyTargetClass=true)
    static class Config {
        @Bean DataSource source() { return new DriverManagerDataSource("jdbc:h2:mem:assessment-lesson;DB_CLOSE_DELAY=-1","sa",""); }
        @Bean JdbcTemplate jdbc(DataSource source) { return new JdbcTemplate(source); }
        @Bean DataSourceTransactionManager transactionManager(DataSource source) { return new DataSourceTransactionManager(source); }
        @Bean com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder specs() { return mock(com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder.class); }
        @Bean LessonService lessons() { return mock(LessonService.class); }
        @Bean ExamServiceImpl exams() { return mock(ExamServiceImpl.class); }
        @Bean SectionRepository sections() { return mock(SectionRepository.class); }
        @Bean AssessmentLessonController controller(LessonService lessons,ExamServiceImpl exams,SectionRepository sections) {
            return new AssessmentLessonController(lessons,exams,sections);
        }
    }
    @Autowired AssessmentLessonController controller;
    @Autowired LessonService lessons;
    @Autowired ExamServiceImpl exams;
    @Autowired SectionRepository sections;
    @Autowired JdbcTemplate jdbc;
    @BeforeEach void setup() {
        exams=org.springframework.test.util.AopTestUtils.getUltimateTargetObject(exams);
        reset(lessons,exams,sections);
        jdbc.execute("create table if not exists lesson_save_probe (id int primary key)");
        jdbc.execute("delete from lesson_save_probe");
        when(sections.findById(11L)).thenReturn(Optional.of(Section.builder().id(11L).course(Course.builder().id(7L).build()).build()));
        when(lessons.create(any())).thenAnswer(call -> {
            jdbc.update("insert into lesson_save_probe values(101)");
            LessonDTO lesson=call.getArgument(0);lesson.setId(101L);return lesson;
        });
        when(exams.create(any())).thenAnswer(call -> { ExamDTO exam=call.getArgument(0);exam.setId(202L);return exam; });
    }
    AssessmentLessonController.Request request(LessonContentType type,ExamCategory category) {
        LessonDTO lesson=LessonDTO.builder().title("Quiz").sectionId(11L).contentType(type).textContent("Answer all questions").orderIndex(0).build();
        ExamDTO exam=new ExamDTO();exam.setTitle("Shared title");exam.setCategory(category);exam.setDurationMinutes(30);
        exam.setCourseId(999L);exam.setSectionId(999L);exam.setLessonId(999L);
        return new AssessmentLessonController.Request(lesson,exam);
    }
    @Test void createsBothAndOverridesClientLinksWithActualLesson() {
        var result=controller.create(request(LessonContentType.QUIZ,ExamCategory.QUIZ));
        assertEquals(101L,result.lesson().getId());assertEquals(202L,result.assessment().getId());
        assertEquals(7L,result.assessment().getCourseId());assertEquals(11L,result.assessment().getSectionId());
        assertEquals(101L,result.assessment().getLessonId());assertEquals(1800,result.lesson().getDuration());
        assertEquals("Shared title",result.lesson().getTitle());
        assertEquals(1,jdbc.queryForObject("select count(*) from lesson_save_probe",Integer.class));
    }
    @Test void failedAssessmentRollsBackTheLessonSave() {
        doThrow(new IllegalStateException("Course allocation exceeds 100%")).when(exams).create(any());
        assertThrows(IllegalStateException.class,()->controller.create(request(LessonContentType.QUIZ,ExamCategory.QUIZ)));
        verify(lessons).create(any());
        assertEquals(0,jdbc.queryForObject("select count(*) from lesson_save_probe",Integer.class));
    }
    @Test void rejectsMismatchedCategoriesBeforeCreatingAnything() {
        assertThrows(ResponseStatusException.class,()->controller.create(request(LessonContentType.ASSIGNMENT,ExamCategory.QUIZ)));
        verifyNoInteractions(lessons,exams);
    }
    @Test void examLessonAcceptsFinalTest() {
        assertEquals(ExamCategory.FINAL_TEST,controller.create(request(LessonContentType.EXAM,ExamCategory.FINAL_TEST)).assessment().getCategory());
    }
    @Test void assignmentLessonAcceptsAssignment() {
        assertEquals(ExamCategory.ASSIGNMENT,controller.create(request(LessonContentType.ASSIGNMENT,ExamCategory.ASSIGNMENT)).assessment().getCategory());
    }
}
