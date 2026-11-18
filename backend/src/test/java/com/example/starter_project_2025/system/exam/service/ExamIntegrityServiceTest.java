package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamIntegrityEvent;
import com.example.starter_project_2025.system.exam.domain.ExamIntegrityEventRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamProctorImageRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.IntegrityEventType;
import com.example.starter_project_2025.system.exam.dto.ExamSimilarityDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamIntegrityServiceTest {

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamIntegrityEventRepository eventRepository;

    @Mock
    private ExamProctorImageRepository proctorImageRepository;

    @Mock
    private ExamSimilarityService similarityService;

    @InjectMocks
    private ExamIntegrityService service;

    private ExamAttempt attempt;

    @BeforeEach
    void setUp() {
        Exam exam = new Exam();
        exam.setId(20L);
        exam.setAntiCheatEnabled(true);

        attempt = new ExamAttempt();
        attempt.setId(30L);
        attempt.setExam(exam);
    }

    @Test
    void summarizeFlagsAttemptWithAnyViolation() {
        when(attemptRepository.findById(30L)).thenReturn(Optional.of(attempt));
        when(eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(30L)).thenReturn(List.of(
                event(IntegrityEventType.TAB_HIDDEN, 5),
                event(IntegrityEventType.COPY, 2)));

        var summary = service.summarize(30L);

        assertTrue(summary.isFlagged());
        assertEquals(2, summary.getTotalViolations());
        assertEquals(1, summary.getTabSwitchCount());
        assertEquals(1, summary.getCopyPasteCount());
        assertEquals(7, summary.getTotalAwaySeconds());
        assertTrue(summary.isAntiCheatEnabled());
    }

    @Test
    void summarizeReportsNoViolationForCleanAttempt() {
        when(attemptRepository.findById(30L)).thenReturn(Optional.of(attempt));
        when(eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(30L)).thenReturn(List.of());

        var summary = service.summarize(30L);

        assertFalse(summary.isFlagged());
        assertEquals(0, summary.getTotalViolations());
    }

    @Test
    void summarizeReportsAntiCheatDisabled() {
        attempt.getExam().setAntiCheatEnabled(false);
        when(attemptRepository.findById(30L)).thenReturn(Optional.of(attempt));
        when(eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(30L)).thenReturn(List.of());

        assertFalse(service.summarize(30L).isAntiCheatEnabled());
    }

    @Test
    void summarizeIsNotFoundForMissingAttempt() {
        when(attemptRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.summarize(404L));
    }

    @Test
    void extremeDurationIsUnderTwentyPercentOfTheExamTime() {
        // 60-minute exam, default 20%: the limit is 12 minutes (720 s)
        assertTrue(ExamIntegrityService.isExtremeDuration(719L, 60, 20));
        assertFalse(ExamIntegrityService.isExtremeDuration(720L, 60, 20));
        // custom 30%: the limit becomes 18 minutes (1080 s)
        assertTrue(ExamIntegrityService.isExtremeDuration(1079L, 60, 30));
        assertFalse(ExamIntegrityService.isExtremeDuration(1080L, 60, 30));
        assertFalse(ExamIntegrityService.isExtremeDuration(null, 60, 20));
        assertFalse(ExamIntegrityService.isExtremeDuration(10L, 0, 20));
    }

    @Test
    void reportFlagsDuplicateContentButOnlyWarnsAboutFastSubmission() {
        Exam exam = attempt.getExam();
        exam.setTitle("Java");
        exam.setDurationMinutes(60);
        ExamAttempt a = finishedAttempt(1L, "Anh", 40L, 30);   // 30 min, duplicate with Binh
        ExamAttempt b = finishedAttempt(2L, "Binh", 41L, 40);  // 40 min, duplicate with Anh
        ExamAttempt c = finishedAttempt(3L, "Chi", 42L, 5);    // 5 min: too fast, but no duplicate

        when(examRepository.findById(20L)).thenReturn(Optional.of(exam));
        when(attemptRepository.findAllByExam_Id(20L)).thenReturn(List.of(a, b, c));
        when(proctorImageRepository.findAttemptIdsWithEntryPhoto(20L)).thenReturn(List.of());
        when(eventRepository.findAllByExamIdOrderByOccurredAtAsc(20L)).thenReturn(List.of());

        ExamSimilarityDTO.SimilarPair pair = new ExamSimilarityDTO.SimilarPair();
        pair.setQuestionId(7L);
        pair.setQuestionDisplayOrder(2);
        pair.setAttemptId1(40L);
        pair.setStudentName1("Anh");
        pair.setAttemptId2(41L);
        pair.setStudentName2("Binh");
        pair.setOverallSimilarity(85.0);
        pair.setMatchType("HIGH_SIMILARITY");
        ExamSimilarityDTO.SimilarPair weak = new ExamSimilarityDTO.SimilarPair();
        weak.setAttemptId1(40L);
        weak.setAttemptId2(42L);
        weak.setOverallSimilarity(55.0);
        ExamSimilarityDTO.SimilarityReport similarity = new ExamSimilarityDTO.SimilarityReport();
        similarity.setPairs(List.of(pair, weak));
        when(similarityService.scanExamSimilarity(eq(20L), eq(false))).thenReturn(similarity);

        var report = service.getReport(20L);

        var rowA = report.getRows().stream().filter(r -> r.getAttemptId() == 40L).findFirst().orElseThrow();
        var rowB = report.getRows().stream().filter(r -> r.getAttemptId() == 41L).findFirst().orElseThrow();
        var rowC = report.getRows().stream().filter(r -> r.getAttemptId() == 42L).findFirst().orElseThrow();
        assertEquals(1, rowA.getDuplicateContentCount());
        assertEquals("Binh", rowA.getDuplicateMatches().get(0).getOtherStudentName());
        assertEquals(1, rowB.getDuplicateContentCount());
        assertEquals("Anh", rowB.getDuplicateMatches().get(0).getOtherStudentName());
        assertTrue(rowA.isFlagged());
        assertTrue(rowB.isFlagged());
        assertEquals(1, rowA.getTotalViolations());
        // weak (55%) pair is below the threshold and the fast submission is only a warning
        assertEquals(0, rowC.getDuplicateContentCount());
        assertTrue(rowC.isExtremeDuration());
        assertFalse(rowC.isFlagged());
        assertFalse(rowA.isExtremeDuration());
        assertEquals(1, report.getExtremeDurationAttempts());
        assertEquals(2, report.getFlaggedAttempts());
        assertEquals(2, report.getTotalsByType().get(ExamIntegrityService.DUPLICATE_CONTENT_KEY));
    }

    private ExamAttempt finishedAttempt(Long studentId, String name, Long attemptId, long minutes) {
        User student = new User();
        student.setId(studentId);
        student.setFirstName(name);
        ExamAttempt a = new ExamAttempt();
        a.setId(attemptId);
        a.setExam(attempt.getExam());
        a.setStudent(student);
        a.setAttemptNumber(1);
        a.setStatus(ExamAttemptStatus.SUBMITTED);
        Instant start = Instant.parse("2026-11-01T08:00:00Z");
        a.setStartedAt(start);
        a.setSubmittedAt(start.plus(minutes, ChronoUnit.MINUTES));
        return a;
    }

    private ExamIntegrityEvent event(IntegrityEventType type, Integer durationSeconds) {
        ExamIntegrityEvent event = new ExamIntegrityEvent();
        event.setAttemptId(30L);
        event.setExamId(20L);
        event.setType(type);
        event.setOccurredAt(Instant.now());
        event.setDurationSeconds(durationSeconds);
        return event;
    }
}
