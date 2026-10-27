package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.study_session.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScheduleSourceRegistryTest {
    private final LocalDateTime from = LocalDateTime.of(2026, 10, 27, 8, 0);

    @Test
    void actualAdapterRepositoryFailureCannotBecomeAnEmptyValidRead() {
        var repository = mock(StudySessionRepository.class);
        when(repository.findPotentialScheduleEntries(from.toLocalDate(), from.toLocalDate())).thenThrow(new IllegalStateException("Database down"));
        when(repository.existsById(1L)).thenThrow(new IllegalStateException("Database down"));
        var source = new StudySessionScheduleSourceAdapter(new StudySessionScheduleSource(repository), repository);
        var registry = new ScheduleSourceRegistry(List.of(source));
        var settings = new ScheduleScopedSettings();
        settings.setSources(Set.of(ScheduleEntryKey.Source.STUDY_SESSION));
        var engine = new ScheduleValidationEngine(mock(SessionRepository.class), mock(ScheduleReferenceProvider.class),
                new ScheduleRules(), mock(ScheduleWriteLockRepository.class), registry, settings);
        var key = new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, 1L);
        var candidate = new ScheduleCandidate(null, 1L, null, 2L, null, 3L, null, null, "Proposal", from, from.plusHours(1));
        var result = engine.validateScoped(new ScheduleValidationBatch(List.of(new ScheduleValidationBatch.Item(candidate, key))));
        assertEquals(ScheduleScopedValidationResult.Status.INCOMPLETE, result.status());
        assertFalse(result.isValid());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("SOURCE_UNAVAILABLE")));
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("LOOKUP_UNAVAILABLE")));
    }

    @Test
    void missingProviderAndIncorrectProviderResultAreExplicitlyIncomplete() {
        var empty = new ScheduleSourceRegistry(List.of());
        assertEquals(ScheduleSessionSource.ReadStatus.MISSING_SOURCE,
                empty.read(ScheduleEntryKey.Source.STUDY_SESSION, from, from.plusHours(1)).status());
        var key = new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION, 1L);
        assertEquals(ScheduleSessionSource.LookupStatus.MISSING_SOURCE, empty.lookup(key).status());
        var wrong = mock(ScheduleSessionSource.class);
        when(wrong.source()).thenReturn(ScheduleEntryKey.Source.STUDY_SESSION);
        when(wrong.findPotentialEntries(from, from.plusHours(1))).thenReturn(
                ScheduleSessionSource.ReadResult.complete(ScheduleEntryKey.Source.DEMO_SESSION, List.of()));
        var registry = new ScheduleSourceRegistry(List.of(wrong));
        assertEquals(ScheduleSessionSource.ReadStatus.UNAVAILABLE,
                registry.read(ScheduleEntryKey.Source.STUDY_SESSION, from, from.plusHours(1)).status());
        assertThrows(IllegalArgumentException.class, () -> new ScheduleSourceRegistry(List.of(wrong, wrong)));
    }
}
