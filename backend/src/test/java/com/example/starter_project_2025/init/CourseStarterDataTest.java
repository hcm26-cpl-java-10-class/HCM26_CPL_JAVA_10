package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.category.*;
import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.section.*;
import com.example.starter_project_2025.system.demo.lesson.*;
import com.example.starter_project_2025.system.rbac.user.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CourseStarterDataTest {
    final CourseRepository courses = mock(CourseRepository.class);
    final CategoryRepository categories = mock(CategoryRepository.class);
    final SectionRepository sections = mock(SectionRepository.class);
    final LessonRepository lessons = mock(LessonRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final Map<String, Course> courseRows = new LinkedHashMap<>();
    final Map<String, Category> categoryRows = new LinkedHashMap<>();
    final Map<Long, Section> sectionRows = new LinkedHashMap<>();
    final Map<Long, Lesson> lessonRows = new LinkedHashMap<>();
    final AtomicLong ids = new AtomicLong();
    CourseDataInitializer initializer;

    @BeforeEach void repositories() {
        when(users.findByEmail("teacher@example.com")).thenReturn(Optional.of(User.builder().firstName("Teacher").lastName("User").build()));
        when(courses.findByName(anyString())).thenAnswer(i -> Optional.ofNullable(courseRows.get(i.getArgument(0))));
        when(courses.save(any(Course.class))).thenAnswer(i -> {
            Course row=i.getArgument(0); if(row.getId()==null)row.setId(ids.incrementAndGet()); courseRows.put(row.getName(),row); return row;
        });
        when(categories.findByCodeIgnoreCase(anyString())).thenAnswer(i -> Optional.ofNullable(categoryRows.get(i.<String>getArgument(0).toUpperCase(Locale.ROOT))));
        when(categories.save(any(Category.class))).thenAnswer(i -> {
            Category row=i.getArgument(0); if(row.getId()==null)row.setId(ids.incrementAndGet()); categoryRows.put(row.getCode(),row); return row;
        });
        when(sections.findByCourse_IdOrderByOrderIndexAsc(anyLong())).thenAnswer(i -> sectionRows.values().stream().filter(r -> r.getCourse().getId().equals(i.getArgument(0))).toList());
        when(sections.save(any(Section.class))).thenAnswer(i -> {
            Section row=i.getArgument(0); if(row.getId()==null)row.setId(ids.incrementAndGet()); sectionRows.put(row.getId(),row); return row;
        });
        when(lessons.findBySection_IdOrderByOrderIndexAsc(anyLong())).thenAnswer(i -> lessonRows.values().stream().filter(r -> r.getSection().getId().equals(i.getArgument(0))).toList());
        when(lessons.save(any(Lesson.class))).thenAnswer(i -> {
            Lesson row=i.getArgument(0); if(row.getId()==null)row.setId(ids.incrementAndGet()); lessonRows.put(row.getId(),row); return row;
        });
        new CategoryDataInitializer(categories).run();
        initializer=new CourseDataInitializer(courses,categories,users,sections,lessons);
    }

    @Test void tenPublishedStartersAndIdempotentCurriculaWithoutAssessments() {
        initializer.run();
        assertEquals(10,courseRows.size()); assertEquals(20,sectionRows.size()); assertEquals(100,lessonRows.size());
        for(Course course:courseRows.values()) {
            assertEquals(CourseStatus.PUBLISHED,course.getStatus()); assertTrue(course.getIsActive()); assertTrue(course.getIsFree());
            assertFalse(course.getCategories().isEmpty()); assertNotNull(course.getInstructorUser());
            assertEquals(2,sectionRows.values().stream().filter(s -> s.getCourse()==course).count());
            assertEquals(10,lessonRows.values().stream().filter(l -> l.getSection().getCourse()==course).count());
        }
        assertEquals(Set.of(LessonContentType.VIDEO,LessonContentType.AUDIO,LessonContentType.TEXT,LessonContentType.DOCUMENT,LessonContentType.LINK),lessonRows.values().stream().map(Lesson::getContentType).collect(java.util.stream.Collectors.toSet()));
        initializer.run();
        assertEquals(10,courseRows.size());assertEquals(20,sectionRows.size());assertEquals(100,lessonRows.size());
        verify(courses,times(10)).save(any());verify(sections,times(20)).save(any());verify(lessons,times(100)).save(any());
    }

    @Test void preservesEditsAndImportedCoursesWhileRepairingMissingRecords() {
        initializer.run();
        Course edited=courseRows.get("REST API Development");edited.setDescription("My edited course");edited.setStatus(CourseStatus.DRAFT);edited.setIsActive(false);edited.getCategories().clear();
        Section section=sectionRows.values().stream().filter(s -> s.getCourse()==edited).findFirst().orElseThrow();section.setTitle("My edited section");section.setIsActive(false);
        Lesson lesson=lessonRows.values().stream().filter(l -> l.getSection()==section).findFirst().orElseThrow();lesson.setTitle("My edited lesson");lesson.setContentUrl("https://example.org/edited");lesson.setIsActive(false);
        Lesson removed=lessonRows.values().stream().filter(l -> l!=lesson).findFirst().orElseThrow();lessonRows.remove(removed.getId());
        Course imported=new Course();imported.setName("Imported course");imported.setDescription("Keep me");courses.save(imported);
        initializer.run();
        assertEquals(11,courseRows.size());assertEquals(20,sectionRows.size());assertEquals(100,lessonRows.size());
        assertEquals("My edited course",edited.getDescription());assertEquals(CourseStatus.DRAFT,edited.getStatus());assertFalse(edited.getIsActive());assertTrue(edited.getCategories().isEmpty());
        assertEquals("My edited section",section.getTitle());assertFalse(section.getIsActive());assertEquals("My edited lesson",lesson.getTitle());assertEquals("https://example.org/edited",lesson.getContentUrl());assertFalse(lesson.getIsActive());assertEquals("Keep me",imported.getDescription());
    }

    @Test void analyticsFixturesStayOnTheOriginalFourDemos() {
        initializer.run();
        Course imported=new Course();imported.setName("Imported course");imported.setIsActive(true);courses.save(imported);
        when(courses.findAll()).thenReturn(new ArrayList<>(courseRows.values()));
        var analytics=mock(CourseAnalyticsDataInitializer.class,CALLS_REAL_METHODS);
        org.springframework.test.util.ReflectionTestUtils.setField(analytics,"courseRepository",courses);
        List<Course> selected=org.springframework.test.util.ReflectionTestUtils.invokeMethod(analytics,"loadCourses");
        assertNotNull(selected);
        assertEquals(Set.of("Java Fundamentals","Spring Boot for Beginners","Java Spring Boot","Database Design"),selected.stream().map(Course::getName).collect(java.util.stream.Collectors.toSet()));
    }

    @Test void actualBundleParserImportsAllTwentyCoursesRelationshipsAndTypesTwice() throws Exception {
        var importer=new CourseBundleImportService(courses,sections,lessons,users,categories);
        var path=java.nio.file.Path.of("test-data/course-import-15-courses-150-lessons.xlsx");
        if (!java.nio.file.Files.isRegularFile(path)) path=java.nio.file.Path.of("..").resolve(path);
        byte[] bytes=java.nio.file.Files.readAllBytes(path);
        var file=new MockMultipartFile("file","courses.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",bytes);
        assertTrue(importer.supports(file));
        for(int pass=0;pass<2;pass++) {
            var result=importer.importBundle(file);assertEquals(0,result.getFailureCount(),result.getErrors().toString());assertEquals(260,result.getSuccessCount());
            assertEquals(20,courseRows.size());assertEquals(40,sectionRows.size());assertEquals(200,lessonRows.size());
        }
        var covered=new HashSet<String>();
        for(Course course:courseRows.values()) {
            assertTrue(course.getIsActive());assertEquals(CourseStatus.PUBLISHED,course.getStatus());assertNotNull(course.getInstructorUser());
            course.getCategories().forEach(c -> covered.add(c.getCode()));
            var outline=sectionRows.values().stream().filter(s -> s.getCourse()==course).toList();assertEquals(2,outline.size());
            assertEquals(Set.of(0,1),outline.stream().map(Section::getOrderIndex).collect(java.util.stream.Collectors.toSet()));
            for(Section section:outline) {
                var content=lessonRows.values().stream().filter(l -> l.getSection()==section).toList();assertEquals(5,content.size());
                assertEquals(Set.of(0,1,2,3,4),content.stream().map(Lesson::getOrderIndex).collect(java.util.stream.Collectors.toSet()));
                assertEquals(Set.of(LessonContentType.VIDEO,LessonContentType.AUDIO,LessonContentType.TEXT,LessonContentType.DOCUMENT,LessonContentType.LINK),content.stream().map(Lesson::getContentType).collect(java.util.stream.Collectors.toSet()));
                for(Lesson lesson:content) {assertTrue(lesson.getIsActive());assertNotNull(lesson.getDuration());assertTrue(lesson.getDuration()>0);if(lesson.getContentType()==LessonContentType.TEXT)assertFalse(lesson.getTextContent().isBlank());else assertTrue(lesson.getContentUrl().startsWith("https://"));}
            }
        }
        assertEquals(categoryRows.keySet(),covered);
    }
}
