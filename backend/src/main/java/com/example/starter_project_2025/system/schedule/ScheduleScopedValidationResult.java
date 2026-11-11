package com.example.starter_project_2025.system.schedule;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Independent result contract. Does not execute or certify any scheduling/business rule. */
public final class ScheduleScopedValidationResult {
    public enum Status { VALID, INVALID, INCOMPLETE }
    public enum Kind { INVALID, INCOMPLETE }

    public record Diagnostic(Kind kind, String code, String field, String message,
                             Integer candidateIndex, Integer relatedCandidateIndex,
                             ScheduleEntryKey relatedEntryKey) {
        public Diagnostic {
            Objects.requireNonNull(kind, "Diagnostic kind is required");
            if (code == null || code.isBlank() || message == null || message.isBlank())
                throw new IllegalArgumentException("Diagnostic code and message are required");
            if ((candidateIndex != null && candidateIndex < 0) || (relatedCandidateIndex != null && relatedCandidateIndex < 0))
                throw new IllegalArgumentException("Candidate indices must be non-negative or null for global issues");
        }

        public static Diagnostic incomplete(String code, String field, String message) {
            return new Diagnostic(Kind.INCOMPLETE, code, field, message, null, null, null);
        }
    }

    private final Status status;
    private final Set<ScheduleEntryKey.Source> requiredSources;
    private final List<Diagnostic> diagnostics;

    private ScheduleScopedValidationResult(Status status, Set<ScheduleEntryKey.Source> requiredSources, List<Diagnostic> diagnostics) {
        this.status = status;
        this.requiredSources = Set.copyOf(requiredSources);
        this.diagnostics = List.copyOf(diagnostics);
    }

    /**
     * The caller supplies its explicit conclusion AFTER running agreed rules and all lookup
     * diagnostics. This method only enforces consistency and completeness of source evidence.
     * It never selects a scope or derives VALID merely from successful/empty source reads.
     * Incomplete evidence takes precedence over INVALID while retaining definite violations.
     */
    public static ScheduleScopedValidationResult fromChecks(Status conclusion,
            Set<ScheduleEntryKey.Source> requiredSources, List<ScheduleSessionSource.ReadResult> reads,
            List<Diagnostic> checkDiagnostics) {
        Objects.requireNonNull(conclusion, "Explicit validation conclusion is required");
        var required = Set.copyOf(requiredSources);
        var issues = new ArrayList<>(List.copyOf(checkDiagnostics));
        var supplied = new HashSet<ScheduleEntryKey.Source>();
        for (var read : List.copyOf(reads)) {
            if (!required.contains(read.source())) throw new IllegalArgumentException("Read is outside the declared scope: " + read.source());
            if (!supplied.add(read.source())) throw new IllegalArgumentException("Duplicate source read: " + read.source());
            issues.addAll(read.diagnostics());
            read.entries().forEach(entry -> issues.addAll(entry.diagnostics()));
        }
        if (required.isEmpty()) issues.add(Diagnostic.incomplete("SOURCE_SCOPE_UNSPECIFIED", "sources", "Validation source scope has not been specified"));
        for (var source : required) {
            if (!supplied.contains(source)) issues.addAll(ScheduleSessionSource.ReadResult.missing(source).diagnostics());
        }
        if (conclusion == Status.INVALID && checkDiagnostics.stream().noneMatch(d -> d.kind() == Kind.INVALID))
            throw new IllegalArgumentException("INVALID conclusion needs a definite validation diagnostic");
        if (conclusion == Status.INCOMPLETE && issues.stream().noneMatch(d -> d.kind() == Kind.INCOMPLETE))
            issues.add(Diagnostic.incomplete("CHECKS_INCOMPLETE", "validation", "Validation checks have not been completed"));
        Status status = issues.stream().anyMatch(d -> d.kind() == Kind.INCOMPLETE) ? Status.INCOMPLETE
                : issues.stream().anyMatch(d -> d.kind() == Kind.INVALID) ? Status.INVALID : conclusion;
        return new ScheduleScopedValidationResult(status, required, issues);
    }

    public Status status() { return status; }
    public Set<ScheduleEntryKey.Source> requiredSources() { return requiredSources; }
    public List<Diagnostic> diagnostics() { return diagnostics; }
    public boolean isValid() { return status == Status.VALID; }
}
