package com.example.starter_project_2025.system.learning.demo;

import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.builder.ExportConfigBuilder;
import com.example.starter_project_2025.base.dataio.exporter.service.GenericExportService;
import com.example.starter_project_2025.base.dataio.exporter.variant.ExcelExporter;
import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.mapper.ValueConverter;
import com.example.starter_project_2025.base.dataio.importer.parser.ExcelParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.parser.RelationPathParser;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationGraphBuilder;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.base.dataio.importer.service.GenericImportService;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.enrollment.*;
import com.example.starter_project_2025.system.learning.LearningRecordsService;
import com.example.starter_project_2025.system.rbac.user.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import javax.sql.DataSource;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

// Slice only: no application startup runners, external services, mail, or existing DB.
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({CourseServiceImpl.class, CourseMapperImpl.class, AutoSpecBuilder.class,
        CourseEnrollmentService.class, LearningRecordsService.class})
class LearningDemoIntegrationTest {
    static final String DATABASE = "jdbc:h2:mem:learning-isolated-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
    @DynamicPropertySource static void isolatedDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> DATABASE);
        registry.add("spring.datasource.driver-class-name", () -> "org.h2.Driver");
        registry.add("spring.datasource.username", () -> "sa");
        registry.add("spring.datasource.password", () -> "");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }

    @Autowired CourseService courses;
    @Autowired CourseRepository courseRepository;
    @Autowired CourseEnrollmentService enrollments;
    @Autowired CourseEnrollmentRepository enrollmentRepository;
    @Autowired LearningRecordsService learning;
    @Autowired UserRepository users;
    @Autowired DataSource dataSource;
    @Autowired ApplicationContext context;
    @Autowired jakarta.persistence.EntityManager entityManager;

    @BeforeEach void authenticate() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertTrue(connection.getMetaData().getURL().startsWith("jdbc:h2:mem:learning-isolated-"));
        }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("isolated-test", null,
                List.of("COURSE_READ", "COURSE_CREATE", "COURSE_UPDATE", "COURSE_DELETE").stream().map(SimpleGrantedAuthority::new).toList()));
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    LearningDemoCourseInitializer initializer() {
        var environment = new MockEnvironment().withProperty("learning.demo.courses.enabled", "true");
        environment.setActiveProfiles("local-demo");
        return new LearningDemoCourseInitializer(courses, dataSource, environment);
    }

    @Test void realServiceSeedsFourAndPreservesIdsMetadataAndEnrollmentsOnRerun() throws Exception {
        initializer().run();
        var importServiceMock = mock(CourseBundleImportService.class);
        var exportControllerMock = mock(CourseBundleExportController.class);
        var controller = new CourseController(courses, courseRepository, importServiceMock, exportControllerMock);
        var list = controller.getAll(PageRequest.of(0, 10), null, null).getBody();
        assertNotNull(list);
        assertEquals(4, list.getTotalElements());
        var original = list.getContent();
        assertTrue(original.stream().allMatch(c -> c.getId() != null && c.getCreatedAt() != null && c.getIsActive()));
        var alice = user("alice@example.test");
        var enrollment = enrollments.enroll(alice.getId(), original.getFirst().getId());
        initializer().run();
        assertEquals(original.stream().map(CourseDTO::getId).sorted().toList(),
                courses.getAll(PageRequest.of(0, 10), null, null).getContent().stream().map(CourseDTO::getId).sorted().toList());
        assertEquals(enrollment.getId(), enrollments.getMyCourses(alice.getId()).getFirst().getId());
        assertEquals(1, enrollmentRepository.count());
    }

    @Test void enrollmentAndLearningUseRealUsersAndKeepProgressUnavailable() throws Exception {
        initializer().run();
        var course = courses.getAll(PageRequest.of(0, 10), "Java Fundamentals", null).getContent().getFirst();
        var alice = user("alice@example.test");
        var bob = user("bob@example.test");
        var controller = new CourseEnrollmentController(enrollments);
        var request = new com.fasterxml.jackson.databind.ObjectMapper().readValue("{\"courseId\":" + course.getId() + "}", CourseEnrollmentController.EnrollRequest.class);
        var alicePrincipal = new UserPrincipal(alice, List.of());
        var confirmed = controller.enroll(alicePrincipal, request);
        assertEquals(course.getId(), confirmed.getCourseId());
        assertThrows(RuntimeException.class, () -> controller.enroll(alicePrincipal, request));
        assertEquals(1, enrollmentRepository.count());
        assertTrue(controller.getMyCourses(new UserPrincipal(bob, List.of())).isEmpty());
        var records = learning.forUser(alice.getId());
        var mapped = records.enrolledCourses().getFirst();
        assertEquals(course.getDescription(), mapped.getCourseDescription());
        assertEquals(course.getThumbnailUrl(), mapped.getThumbnailUrl());
        assertEquals(course.getInstructor(), mapped.getInstructor());
        assertNull(records.overallProgress());
        assertNull(records.completedCourses());
        assertTrue(learning.forUser(bob.getId()).enrolledCourses().isEmpty());
        assertThrows(RuntimeException.class, () -> enrollments.cancelEnrollment(bob.getId(), confirmed.getId()));
        initializer().run();
        assertEquals(confirmed.getId(), controller.getMyCourses(alicePrincipal).getFirst().getId());
    }

    @Test void courseCrudStillUsesUnchangedServiceAndPermissions() {
        var request = CourseDTO.builder().name("Isolated CRUD fixture").description("Initial").instructor("Fixture instructor").build();
        request.setIsActive(true);
        var created = courses.create(request);
        var update = CourseDTO.builder().description("Updated").build();
        update.setIsActive(false);
        var changed = courses.update(created.getId(), update);
        assertEquals("Updated", changed.getDescription());
        assertFalse(changed.getIsActive());
        assertEquals(created.getName(), courses.getById(created.getId()).getName());
        SecurityContextHolder.clearContext();
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> courses.create(request));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("fixture", null, List.of(new SimpleGrantedAuthority("COURSE_DELETE"))));
        courses.delete(created.getId());
        assertFalse(courseRepository.existsById(created.getId()));
    }

    @Test void documentsExistingBackendXlsxLimitationsWithoutChangingCourseCode() throws Exception {
        var exporter = new GenericExportService(List.of(new ExcelExporter()), mock(ExportConfigBuilder.class));
        var exportFailure = assertThrows(IllegalArgumentException.class, () -> exporter.export(FileFormat.EXCEL, List.<Course>of(), Course.class, new MockHttpServletResponse()));
        assertTrue(exportFailure.getMessage().contains("@ExportEntity"));
        var lookup = new RelationLookupEngine(context);
        var mapper = new GenericImportMapper(lookup, new RelationGraphBuilder(lookup, new RelationPathParser()), new ValueConverter());
        var importer = new GenericImportService(new ParserFactory(List.of(new ExcelParser())), mapper, mock(org.springframework.security.crypto.password.PasswordEncoder.class), List.of(), lookup);
        byte[] bytes;
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Courses");
            sheet.createRow(0).createCell(0).setCellValue("Name");
            sheet.createRow(1).createCell(0).setCellValue("Isolated XLSX fixture");
            workbook.write(output);
            bytes = output.toByteArray();
        }
        long before = courseRepository.count();
        var result = importer.importFile(new MockMultipartFile("file", "courses.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes), Course.class, courseRepository);
        assertEquals(0, result.getSuccessCount());
        assertEquals(1, result.getFailureCount());
        entityManager.clear();
        assertEquals(before, courseRepository.count());
    }

    User user(String email) {
        return users.saveAndFlush(User.builder().email(email).passwordHash("isolated-test-only").firstName("Fixture").build());
    }
}