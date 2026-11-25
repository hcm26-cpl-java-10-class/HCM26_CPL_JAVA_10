package com.example.starter_project_2025.system.learning.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.*;
import com.example.starter_project_2025.system.learning.habits.HabitStatistics;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.time.*;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static com.example.starter_project_2025.system.learning.report.ReportData.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.HttpStatus.*;

@DataJpaTest(showSql=false, properties="spring.jpa.hibernate.ddl-auto=create-drop")
@ImportAutoConfiguration(JacksonAutoConfiguration.class)
@Import({ReportService.class, ReportExport.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
class ReportIntegrationTest {
    @Autowired ReportService reports;
    @Autowired ReportExport export;
    @Autowired UserRepository users;
    @Autowired ObjectMapper mapper;
    @MockBean ReportAggregation aggregation;
    @MockBean HabitStatistics habits;
    @MockBean ReportAi ai;
    UserPrincipal learner;
    UserPrincipal other;

    @BeforeEach void setup() {
        learner = principal();
        other = principal();
        when(habits.reportingZone()).thenReturn(ZoneId.of("Asia/Ho_Chi_Minh"));
    }

    @Test void datesValidateCalendarBoundariesAndFutureDates() {
        var end = LocalDate.parse("2026-11-25");
        assertTrue(ReportService.validatePeriod(input(Type.WEEKLY, "2026-11-23", "2026-11-25"), end, 366));
        assertTrue(ReportService.validatePeriod(input(Type.MONTHLY, "2026-11-01", "2026-11-25"), end, 366));
        assertFalse(ReportService.validatePeriod(input(Type.QUARTERLY, "2026-07-01", "2026-09-30"), end, 366));
        assertFalse(ReportService.validatePeriod(input(Type.CUSTOM, "2026-11-10", "2026-11-24"), end, 366));
        assertThrows(ResponseStatusException.class, () ->
            ReportService.validatePeriod(input(Type.WEEKLY, "2026-11-24", "2026-11-25"), end, 366));
        assertThrows(ResponseStatusException.class, () ->
            ReportService.validatePeriod(input(Type.CUSTOM, "2026-11-24", "2026-11-26"), end, 366));
        assertThrows(ResponseStatusException.class, () ->
            ReportService.validatePeriod(input(Type.CUSTOM, "2026-11-01", "2026-11-25"), end, 7));
    }

    @Test void persistsSnapshotIdempotentlyAndExportsVietnameseAndNumericValues() throws Exception {
        var request = input(Type.CUSTOM, "2026-10-01", "2026-10-28");
        var original = snapshot();
        when(aggregation.snapshot(any(), any(), anySet())).thenReturn(original);
        var first = reports.create(learner, request);
        assertEquals(first.report().id(), reports.create(learner, request).report().id());
        assertEquals(40d, first.snapshot().overview().completionRate());
        assertEquals(54d, first.snapshot().overview().averageProgress());
        assertEquals(87.5d, first.snapshot().study().achievement());
        assertEquals(5400L, first.snapshot().study().remainingSeconds());
        assertEquals(6, first.snapshot().objectives().completed());
        assertEquals(25d, first.snapshot().roadmap().completionRate());
        assertEquals(AnalysisStatus.NOT_REQUESTED, first.report().aiStatus());
        verify(ai, never()).generate(any(), any(), any());

        try (var book = WorkbookFactory.create(new ByteArrayInputStream(export.workbook(first)))) {
            assertEquals(CellType.STRING, book.getSheet("Overview").getRow(0).getCell(1).getCellType());
            assertEquals("=Báo cáo học tập", book.getSheet("Overview").getRow(0).getCell(1).getStringCellValue());
            assertEquals(0.875d, book.getSheet("Learning Goals").getRow(5).getCell(1).getNumericCellValue());
            assertEquals(630d, book.getSheet("Learning Goals").getRow(0).getCell(1).getNumericCellValue());
        }

        when(aggregation.snapshot(any(), any(), anySet())).thenReturn(new Snapshot("Learner", null, null,
            null, null, null, null, List.of()));
        var updated = reports.create(learner, input(Type.CUSTOM, "2026-10-01", "2026-10-28"));
        assertNotEquals(first.report().id(), updated.report().id());
        assertNull(updated.snapshot().study());
        assertEquals(87.5, reports.detail(learner, first.report().id()).snapshot().study().achievement());
        assertEquals(2, reports.history(learner, Type.CUSTOM, null, null, 0, 10).matches());
        assertTrue(reports.history(other, null, null, null, 0, 10).items().isEmpty());
        assertEquals(NOT_FOUND, assertThrows(ResponseStatusException.class, () -> reports.detail(other, first.report().id())).getStatusCode());
        assertEquals(NOT_FOUND, assertThrows(ResponseStatusException.class, () -> reports.delete(other, first.report().id())).getStatusCode());
        assertEquals("Đã sửa", reports.rename(learner, first.report().id(), new Title("Đã sửa")).title());
        reports.delete(learner, updated.report().id());
        assertEquals(1, reports.history(learner, null, null, null, 0, 10).totalSaved());
    }

    @Test void aiFailurePreservesStatisticsAndRetryAddsOnlyAnalysis() {
        var request = input(Type.CUSTOM, "2026-10-01", "2026-10-28");
        var aiRequest = new Input(request.requestKey(), request.title(), request.type(), request.from(), request.to(),
            Mode.AI_ENHANCED, request.language(), request.sections());
        when(aggregation.snapshot(any(), any(), anySet())).thenReturn(snapshot());
        when(ai.available()).thenReturn(true);
        var analysis = new Analysis("Có dữ liệu học tập", List.of(), List.of(), List.of(), List.of("Đọc", "Viết", "Ôn"), List.of());
        when(ai.generate(any(), any(), any())).thenThrow(new ResponseStatusException(SERVICE_UNAVAILABLE)).thenReturn(analysis);
        var failed = reports.create(learner, aiRequest);
        assertEquals(AnalysisStatus.UNAVAILABLE, failed.report().aiStatus());
        assertTrue(failed.report().retryable());
        var finished = reports.retry(learner, failed.report().id());
        assertEquals(AnalysisStatus.AVAILABLE, finished.report().aiStatus());
        assertEquals(failed.snapshot(), finished.snapshot());
        assertEquals(analysis, finished.analysis());
    }

    @Test void aiParserRejectsUnknownEvidenceCourseAndNumericProse() throws Exception {
        var parser = new ReportAi(null, mapper);
        var json = mapper.readTree("""
            {"executiveSummary":"Study was recorded","achievements":[{"title":"Practice","description":"Keep going",
            "evidenceMetricIds":["activeDays"]}],"improvementAreas":[],"recommendations":[{"priority":"HIGH","action":"Read",
            "reason":"Review the material","relatedCourseIds":["c1"]}],"nextPeriodActionPlan":["Read","Write","Review"],"dataLimitations":[]}
            """);
        assertEquals(List.of("course_7"),
            parser.validate(json, Set.of("activeDays"), Map.of("c1", "course_7")).recommendations().getFirst().relatedCourseIds());
        assertThrows(IllegalArgumentException.class, () -> parser.validate(json, Set.of(), Map.of("c1", "course_7")));
        assertThrows(IllegalArgumentException.class, () -> parser.validate(json, Set.of("activeDays"), Map.of()));
        ((com.fasterxml.jackson.databind.node.ObjectNode) json).put("executiveSummary", "Invented 14%");
        assertThrows(IllegalArgumentException.class, () -> parser.validate(json, Set.of("activeDays"), Map.of("c1", "course_7")));
    }

    private Snapshot snapshot() {
        var courseRows = List.of(new Course(1L, "A", null, "COMPLETED", 100, null, null),
            new Course(2L, "B", null, "COMPLETED", 100, null, null),
            new Course(3L, "C", null, "IN_PROGRESS", 45, null, null),
            new Course(4L, "D", null, "IN_PROGRESS", 25, null, null),
            new Course(5L, "E", null, "ENROLLED", 0, null, null));
        var study = new HabitStatistics.ReportStudy(37800, 0, 37800, 43200L, 5400L, 37800L, 87.5,
            28, 0, 0, 0, 0, List.of(), List.of(), List.of(), null);
        var roadmap = new Roadmap("Goal", "BEGINNER", "Plan", 1L, null, 4, 720, 1, 25d, List.of(
            new Phase("A", 1, 1, "COMPLETED", null, List.of()), new Phase("B", 2, 2, "CURRENT", null, List.of()),
            new Phase("C", 3, 3, "UPCOMING", null, List.of()), new Phase("D", 4, 4, "UPCOMING", null, List.of())));
        return new Snapshot("Nguyễn Văn Ánh", ReportAggregation.overview(courseRows, 2), courseRows, study,
            roadmap, new HabitStatistics.ReportStudy.Objectives(8, 6, 1, 4), null, List.of());
    }
    private Input input(Type type, String from, String to) {
        return new Input(UUID.randomUUID(), "=Báo cáo học tập", type, LocalDate.parse(from), LocalDate.parse(to),
            Mode.STANDARD, Language.VI, Set.of(Section.OVERVIEW, Section.COURSES, Section.STUDY, Section.OBJECTIVES, Section.ROADMAP));
    }
    private UserPrincipal principal() {
        User user = users.saveAndFlush(User.builder().email(UUID.randomUUID() + "@example.test")
            .passwordHash("test").firstName("Learner").build());
        return new UserPrincipal(user, List.of("LEARNER_ACCESS", "LEARNING_SELF_READ", "COURSE_READ",
            "LESSON_PROGRESS_READ").stream().map(SimpleGrantedAuthority::new).toList());
    }
}
