package com.example.starter_project_2025.system.schedule;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.example.starter_project_2025.system.schedule.ScheduleEntryKey.Source.*;
import static com.example.starter_project_2025.system.schedule.ScheduleScopedValidationResult.*;
import static com.example.starter_project_2025.system.schedule.ScheduleSessionSource.*;
import static org.junit.jupiter.api.Assertions.*;

/** Contract invariants only: no Engine, Spring, database, policies or external calls. */
class ScheduleScopedContractsTest {
    @Test
    void positiveIdsAreQualifiedBySourceIncludingLongMaximum() {
        var study = new ScheduleEntryKey(STUDY_SESSION, 1L);
        var demo = new ScheduleEntryKey(DEMO_SESSION, 1L);
        assertNotEquals(study, demo);
        assertEquals(study, new ScheduleEntryKey(STUDY_SESSION, 1L));
        assertEquals(2, Set.of(study, demo).size());
        assertEquals(Long.MAX_VALUE, new ScheduleEntryKey(STUDY_SESSION, Long.MAX_VALUE).id());
        assertThrows(NullPointerException.class, () -> new ScheduleEntryKey(null, 1L));
        assertThrows(IllegalArgumentException.class, () -> new ScheduleEntryKey(STUDY_SESSION, null));
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1, Long.MIN_VALUE})
    void rejectsNonPositiveIdentity(long id) {
        assertThrows(IllegalArgumentException.class, () -> new ScheduleEntryKey(STUDY_SESSION, id));
    }

    @Test
    void batchDetectsDuplicatesOnlyForSameSourceAndKeepsCreateUnidentified() {
        var study = new ScheduleValidationBatch.Item(candidate(), new ScheduleEntryKey(STUDY_SESSION, 1L));
        var demo = new ScheduleValidationBatch.Item(candidate(), new ScheduleEntryKey(DEMO_SESSION, 1L));
        var create = new ScheduleValidationBatch.Item(candidate(), null);
        var batch = new ScheduleValidationBatch(List.of(study, demo, create, create));
        assertEquals(2, batch.replacedKeys().size());
        assertThrows(IllegalArgumentException.class, () -> new ScheduleValidationBatch(List.of(study, study)));
        assertThrows(UnsupportedOperationException.class, () -> batch.replacedKeys().clear());
        assertThrows(UnsupportedOperationException.class, () -> batch.candidates().clear());
    }

    @Test
    void scopedPayloadCannotCarryUnqualifiedNumericIdentity() {
        var payload = new ScheduleCandidate(1L, null, null, null, null, null, null, null, null, null, null);
        var key = new ScheduleEntryKey(STUDY_SESSION, 1L);
        assertThrows(IllegalArgumentException.class, () -> new ScheduleValidationBatch.Item(payload, key));
        assertThrows(IllegalArgumentException.class, () -> new Entry(key, payload, null, null, List.of()));
        assertThrows(NullPointerException.class, () -> new ScheduleValidationBatch.Item(null, key));
    }

    @Test
    void unknownFactsCanCarryStructuredDiagnosticWithoutInferringValues() {
        var missing = Diagnostic.incomplete("MISSING_DATA", "trainerId", "Trainer ID is unknown");
        var entry = new Entry(new ScheduleEntryKey(STUDY_SESSION, 1L), candidate(), "COMPLETED", false, List.of(missing));
        var read = ReadResult.complete(STUDY_SESSION, List.of(entry));
        var result = fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(read), List.of());
        assertEquals(Status.INCOMPLETE, result.status());
        assertFalse(result.isValid());
        assertEquals("COMPLETED", entry.rawStatus());
        assertFalse(entry.isActive());
        assertNull(entry.facts().trainerId());
        assertNull(entry.facts().topicId());
        assertNull(entry.facts().roomId());
        assertEquals(List.of(missing), result.diagnostics());
    }

    @Test
    void unavailableAndMissingSourcesNeverBecomeValidEmptySchedules() {
        var failed = ReadResult.unavailable(STUDY_SESSION, "Database unavailable");
        var result = fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(failed), List.of());
        assertFalse(result.isValid());
        assertEquals(Status.INCOMPLETE, result.status());
        assertEquals("SOURCE_UNAVAILABLE", result.diagnostics().getFirst().code());
        var missing = fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(), List.of());
        assertEquals(Status.INCOMPLETE, missing.status());
        assertEquals("SOURCE_MISSING", missing.diagnostics().getFirst().code());
        var explicitMissing = fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(ReadResult.missing(STUDY_SESSION)), List.of());
        assertFalse(explicitMissing.isValid());
    }

    @Test
    void genuinelyEmptyReadStillNeedsExplicitCompletedValidationConclusion() {
        var reads = List.of(ReadResult.complete(STUDY_SESSION, List.of()));
        var pending = fromChecks(Status.INCOMPLETE, Set.of(STUDY_SESSION), reads, List.of());
        assertEquals(Status.INCOMPLETE, pending.status());
        assertFalse(pending.isValid());
        var valid = fromChecks(Status.VALID, Set.of(STUDY_SESSION), reads, List.of());
        assertTrue(valid.isValid()); // Explicit caller conclusion, not a conclusion derived from the empty read.
        assertThrows(NullPointerException.class, () -> fromChecks(null, Set.of(STUDY_SESSION), reads, List.of()));
        assertFalse(fromChecks(Status.VALID, Set.of(), List.of(), List.of()).isValid());
    }

    @Test
    void noImplicitScopeSelectionAndNoDuplicateOrForeignSourceEvidence() {
        var demo = ReadResult.complete(DEMO_SESSION, List.of());
        var study = ReadResult.complete(STUDY_SESSION, List.of());
        assertFalse(fromChecks(Status.VALID, Set.of(DEMO_SESSION, STUDY_SESSION), List.of(demo), List.of()).isValid());
        assertTrue(fromChecks(Status.VALID, Set.of(DEMO_SESSION, STUDY_SESSION), List.of(demo, study), List.of()).isValid());
        assertThrows(IllegalArgumentException.class, () -> fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(study, study), List.of()));
        assertThrows(IllegalArgumentException.class, () -> fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(demo), List.of()));
        var entry = new Entry(new ScheduleEntryKey(DEMO_SESSION, 1L), candidate(), null, null, List.of());
        assertThrows(IllegalArgumentException.class, () -> ReadResult.complete(STUDY_SESSION, List.of(entry)));
        assertThrows(IllegalArgumentException.class, () -> ReadResult.complete(DEMO_SESSION, List.of(entry, entry)));
    }

    @Test
    void definiteConflictsAreRetainedWhenIncompleteEvidenceTakesPrecedence() {
        var conflict = new Diagnostic(Kind.INVALID, "CLASS_CONFLICT", "classId", "Class conflict", 0, null,
                new ScheduleEntryKey(DEMO_SESSION, 1L));
        var result = fromChecks(Status.INVALID, Set.of(STUDY_SESSION), List.of(), List.of(conflict));
        assertEquals(Status.INCOMPLETE, result.status());
        assertTrue(result.diagnostics().contains(conflict));
        assertFalse(result.isValid());
        var complete = fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(ReadResult.complete(STUDY_SESSION, List.of())), List.of(conflict));
        assertEquals(Status.INVALID, complete.status());
        assertFalse(complete.isValid());
        assertThrows(IllegalArgumentException.class, () -> fromChecks(Status.INVALID, Set.of(), List.of(), List.of()));
    }

    @Test
    void failedReadCannotMasqueradeAsCompleteOrDropItsDiagnostic() {
        assertThrows(IllegalArgumentException.class, () -> new ReadResult(STUDY_SESSION, ReadStatus.UNAVAILABLE, List.of(), List.of()));
        var issue = Diagnostic.incomplete("SOURCE_UNAVAILABLE", "source", "Unavailable");
        assertThrows(IllegalArgumentException.class, () -> new ReadResult(STUDY_SESSION, ReadStatus.COMPLETE, List.of(), List.of(issue)));
        var entry = new Entry(new ScheduleEntryKey(STUDY_SESSION, 1L), candidate(), null, null, List.of());
        assertThrows(IllegalArgumentException.class, () -> new ReadResult(STUDY_SESSION, ReadStatus.UNAVAILABLE, List.of(entry), List.of(issue)));
        var partial = new ReadResult(STUDY_SESSION, ReadStatus.INCOMPLETE, List.of(entry), List.of(issue));
        assertFalse(fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(partial), List.of()).isValid());
    }

    @Test
    void existenceFailureIsDistinctFromSuccessfulNotFoundLookup() {
        var key = new ScheduleEntryKey(STUDY_SESSION, 1L);
        assertEquals(LookupStatus.FOUND, new LookupResult(key, LookupStatus.FOUND, List.of()).status());
        assertEquals(LookupStatus.NOT_FOUND, new LookupResult(key, LookupStatus.NOT_FOUND, List.of()).status());
        assertThrows(IllegalArgumentException.class, () -> new LookupResult(key, LookupStatus.UNAVAILABLE, List.of()));
        var issue = Diagnostic.incomplete("LOOKUP_UNAVAILABLE", "id", "Lookup failed");
        assertThrows(IllegalArgumentException.class, () -> new LookupResult(key, LookupStatus.NOT_FOUND, List.of(issue)));
        var failed = new LookupResult(key, LookupStatus.UNAVAILABLE, List.of(issue));
        var result = fromChecks(Status.VALID, Set.of(STUDY_SESSION), List.of(ReadResult.complete(STUDY_SESSION, List.of())), failed.diagnostics());
        assertEquals(Status.INCOMPLETE, result.status());
    }

    @Test
    void defensiveCopiesPreventMutationOfEvidenceAndCandidates() {
        var items = new ArrayList<>(List.of(new ScheduleValidationBatch.Item(candidate(), null)));
        var batch = new ScheduleValidationBatch(items);
        items.clear();
        assertEquals(1, batch.candidates().size());
        var scope = new HashSet<>(Set.of(STUDY_SESSION));
        var issues = new ArrayList<>(List.of(Diagnostic.incomplete("PENDING", "policy", "Policy pending")));
        var result = fromChecks(Status.INCOMPLETE, scope, List.of(ReadResult.complete(STUDY_SESSION, List.of())), issues);
        scope.clear();
        issues.clear();
        assertEquals(Set.of(STUDY_SESSION), result.requiredSources());
        assertEquals(1, result.diagnostics().size());
        assertThrows(UnsupportedOperationException.class, () -> result.diagnostics().clear());
        assertThrows(UnsupportedOperationException.class, () -> result.requiredSources().clear());
    }

    private ScheduleCandidate candidate() {
        // Missing facts are intentionally permitted by the structural contract, not certified as valid.
        return new ScheduleCandidate(null, null, null, null, null, null, null, null, null, null, null);
    }
}
