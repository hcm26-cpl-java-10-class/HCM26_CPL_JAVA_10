package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.study_session.StudySessionRepository;
import com.example.starter_project_2025.system.study_session.StudySessionScheduleSource;
import com.example.starter_project_2025.system.study_session.StudySessionScheduleSourceAdapter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/** Exercises the real transaction boundary; no outer test rollback can mask commit errors. */
@DataJpaTest
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import({ScheduleValidationEngine.class, ScheduleSourceRegistry.class, ScheduleScopedSettings.class,
        ScheduleRules.class, StudySessionScheduleSource.class, StudySessionScheduleSourceAdapter.class,
        DemoSessionScheduleSource.class})
class ScheduleScopedTransactionBoundaryTest {
    @Autowired ScheduleValidationEngine engine;
    @Autowired ScheduleScopedSettings settings;
    @SpyBean StudySessionRepository sessions;
    @MockBean ScheduleReferenceProvider references;

    @Test
    void standalonePreviewReturnsIncompleteAfterSourceTransactionRollsBack() {
        assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
        settings.setSources(Set.of(ScheduleEntryKey.Source.STUDY_SESSION));
        var start = LocalDateTime.of(2026, 10, 27, 8, 0);
        doThrow(new IllegalStateException("Simulated repository failure"))
                .when(sessions).findPotentialScheduleEntries(start.toLocalDate(), start.toLocalDate());
        var candidate = new ScheduleCandidate(null, 101L, null, 201L, null, 301L,
                null, null, "Boundary proposal", start, start.plusHours(1));
        var batch = new ScheduleValidationBatch(List.of(new ScheduleValidationBatch.Item(candidate, null)));

        var result = assertDoesNotThrow(() -> engine.validateScoped(batch));

        assertEquals(ScheduleScopedValidationResult.Status.INCOMPLETE, result.status());
        assertFalse(result.isValid());
        assertTrue(result.diagnostics().stream().anyMatch(issue -> issue.code().equals("SOURCE_UNAVAILABLE")));
        verify(sessions).findPotentialScheduleEntries(start.toLocalDate(), start.toLocalDate());
        assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
    }
}
