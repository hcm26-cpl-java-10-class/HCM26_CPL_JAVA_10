package com.example.starter_project_2025.system.learning.demo;

import com.example.starter_project_2025.system.demo.course.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LearningDemoCourseInitializerTest {
    final CourseService courses = mock(CourseService.class);
    final DataSource dataSource = mock(DataSource.class);
    final MockEnvironment environment = new MockEnvironment().withProperty("learning.demo.courses.enabled", "true");
    final List<CourseDTO> records = new ArrayList<>();
    final LearningDemoCourseInitializer initializer = new LearningDemoCourseInitializer(courses, dataSource, environment);

    @BeforeEach void setup() throws Exception {
        environment.setActiveProfiles("local-demo");
        target("H2", "jdbc:h2:mem:learning-demo-tests");
        when(courses.getAll(any(Pageable.class), isNull(), isNull())).thenAnswer(call -> {
            Pageable page = call.getArgument(0);
            int start = Math.min((int) page.getOffset(), records.size());
            return new PageImpl<>(new ArrayList<>(records.subList(start, Math.min(start + page.getPageSize(), records.size()))), page, records.size());
        });
        when(courses.create(any())).thenAnswer(call -> {
            CourseDTO request = call.getArgument(0);
            assertNull(request.getId());
            assertNull(request.getCreatedAt());
            assertNull(request.getUpdatedAt());
            assertEquals(List.of("COURSE_READ", "COURSE_CREATE"), SecurityContextHolder.getContext()
                    .getAuthentication().getAuthorities().stream().map(a -> a.getAuthority()).toList());
            request.setId((long) records.size() + 1);
            records.add(request);
            return request;
        });
    }

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    void target(String product, String url) throws Exception {
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getDatabaseProductName()).thenReturn(product);
        when(metadata.getURL()).thenReturn(url);
    }

    @Test void createsExactlyFourSupportedRecordsAndRerunPreservesThem() throws Exception {
        var original = SecurityContextHolder.getContext();
        original.setAuthentication(new UsernamePasswordAuthenticationToken("previous", null, List.of()));
        initializer.run();
        assertSame(original, SecurityContextHolder.getContext());
        assertEquals(List.of("Java Fundamentals", "Spring Boot for Beginners", "Java Spring Boot", "Database Design"), records.stream().map(CourseDTO::getName).toList());
        assertEquals("Khóa học Java và phát triển backend với Spring Boot", records.get(2).getDescription());
        assertEquals(List.of("iCYoaTvE9vo", "efCONw5rdA4", "RksqUNilQwc", "LuVEozf3wnU"),
                records.stream().map(c -> c.getThumbnailUrl().split("/")[4]).toList());
        assertTrue(records.stream().allMatch(c -> "Teacher User".equals(c.getInstructor()) && Boolean.TRUE.equals(c.getIsActive())));
        var before = List.copyOf(records);
        initializer.run();
        assertEquals(before, records);
        verify(courses, times(4)).create(any());
    }

    @Test void normalizedNamesAreOnlyASkipKeyEvenWithMultipleMatchingRowsAndPagination() throws Exception {
        for (int i = 0; i < 101; i++) records.add(CourseDTO.builder().name("Unrelated " + i).build());
        var existing = CourseDTO.builder().name("  JAVA\u00a0 FUNDAMENTALS  ").description("Keep this").build();
        existing.setId(999L);
        records.add(existing);
        records.add(CourseDTO.builder().name("java fundamentals").build());
        initializer.run();
        assertEquals(106, records.size());
        assertEquals("Keep this", existing.getDescription());
        assertEquals(999L, existing.getId());
        verify(courses, times(3)).create(any());
        verify(courses, never()).update(any(), any());
        verify(courses, never()).delete(any());
    }

    @Test void rejectsFileMysqlTcpUnknownAndUnnamedTargetsBeforeServiceCalls() throws Exception {
        for (String[] target : List.of(new String[]{"H2", "jdbc:h2:file:./data/base_crud"},
                new String[]{"MySQL", "jdbc:mysql://localhost/demo"}, new String[]{"H2", "jdbc:h2:tcp://localhost/mem:demo"},
                new String[]{"Unknown", "jdbc:h2:mem:demo"}, new String[]{"H2", "jdbc:h2:mem:"}, new String[]{"H2", null})) {
            target(target[0], target[1]);
            assertThrows(IllegalStateException.class, initializer::run);
        }
        verifyNoInteractions(courses);
    }

    @Test void rejectsMissingFlagAndAdditionalOrUnknownProfiles() {
        for (String[] profiles : List.of(new String[]{}, new String[]{"prod"}, new String[]{"local-demo", "production"}, new String[]{"local-demo", "unknown"})) {
            environment.setActiveProfiles(profiles);
            assertThrows(IllegalStateException.class, initializer::run);
        }
        environment.setActiveProfiles("local-demo");
        environment.setProperty("learning.demo.courses.enabled", "false");
        assertThrows(IllegalStateException.class, initializer::run);
        verifyNoInteractions(courses);
    }

    @Test void restoresSecurityContextAndPropagatesUnrelatedCreateFailure() {
        var original = SecurityContextHolder.getContext();
        doThrow(new IllegalArgumentException("Storage failed")).when(courses).create(any());
        assertThrows(IllegalArgumentException.class, initializer::run);
        assertSame(original, SecurityContextHolder.getContext());
    }

    @Configuration(proxyBeanMethods = false)
    @Import(LearningDemoCourseInitializer.class)
    static class Config {}

    @Test void springRegistrationRequiresBothOptIns() {
        var runner = new ApplicationContextRunner().withUserConfiguration(Config.class)
                .withBean(CourseService.class, () -> courses).withBean(DataSource.class, () -> dataSource);
        runner.run(context -> assertEquals(0, context.getBeansOfType(LearningDemoCourseInitializer.class).size()));
        runner.withPropertyValues("learning.demo.courses.enabled=true")
                .run(context -> assertEquals(0, context.getBeansOfType(LearningDemoCourseInitializer.class).size()));
        var demo = runner.withInitializer(context -> context.getEnvironment().setActiveProfiles("local-demo"));
        demo.run(context -> assertEquals(0, context.getBeansOfType(LearningDemoCourseInitializer.class).size()));
        demo.withPropertyValues("learning.demo.courses.enabled=true")
                .run(context -> assertEquals(1, context.getBeansOfType(LearningDemoCourseInitializer.class).size()));
    }
}
