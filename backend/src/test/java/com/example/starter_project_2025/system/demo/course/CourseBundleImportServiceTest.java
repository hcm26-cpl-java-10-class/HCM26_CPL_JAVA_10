package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CourseBundleImportServiceTest {

    @Test
    void importsInstructorAndCategoryRelationships() throws Exception {
        CourseRepository courses = mock(CourseRepository.class);
        SectionRepository sections = mock(SectionRepository.class);
        LessonRepository lessons = mock(LessonRepository.class);
        UserRepository users = mock(UserRepository.class);
        CategoryRepository categories = mock(CategoryRepository.class);
        User teacher = User.builder().firstName("Teacher").lastName("User").build();
        Category category = Category.builder().code("JAVA").name("Java").build();

        when(courses.findByName("Java 21 Fundamentals")).thenReturn(Optional.empty());
        when(users.findByEmail("teacher@example.com")).thenReturn(Optional.of(teacher));
        when(categories.findByCodeIgnoreCase("JAVA")).thenReturn(Optional.of(category));
        when(courses.save(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var service = new CourseBundleImportService(courses, sections, lessons, users, categories);
        service.importBundle(workbook());

        var savedCourse = org.mockito.ArgumentCaptor.forClass(Course.class);
        verify(courses).save(savedCourse.capture());
        assertSame(teacher, savedCourse.getValue().getInstructorUser());
        assertTrue(savedCourse.getValue().getCategories().contains(category));
    }

    private MockMultipartFile workbook() throws Exception {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var courses = workbook.createSheet("Courses");
            var header = courses.createRow(0);
            String[] columns = {"Name", "Description", "Instructor", "Thumbnail URL", "Status", "Level", "Active", "Instructor Email", "Category Codes"};
            for (int i = 0; i < columns.length; i++) header.createCell(i).setCellValue(columns[i]);
            var row = courses.createRow(1);
            String[] values = {"Java 21 Fundamentals", "Description", "Teacher User", "", "PUBLISHED", "BEGINNER", "true", "teacher@example.com", "JAVA"};
            for (int i = 0; i < values.length; i++) row.createCell(i).setCellValue(values[i]);
            workbook.createSheet("Sections").createRow(0).createCell(0).setCellValue("Course Name");
            workbook.createSheet("Lessons").createRow(0).createCell(0).setCellValue("Course Name");
            workbook.write(output);
            return new MockMultipartFile("file", "courses.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", output.toByteArray());
        }
    }
}
