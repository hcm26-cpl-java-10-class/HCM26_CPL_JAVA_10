package com.example.starter_project_2025.system.learning.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.learning.habits.HabitStatistics;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.time.temporal.*;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.learning.report.ReportData.*;
import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
@Slf4j
class ReportService {
    static final Duration LEASE = Duration.ofMinutes(5);
    private final LearningReportRepository reports;
    private final ReportAggregation aggregation;
    private final ReportAi ai;
    private final HabitStatistics habits;
    private final ObjectMapper mapper;
    private final EntityManager entityManager;
    private final PlatformTransactionManager transactions;

    @Value("${app.learning.reports.max-days:366}")
    private int configuredMax;

    Options options(UserPrincipal principal) {
        ZoneId zone = habits.reportingZone();
        return new Options(LocalDate.now(zone), zone.getId(), maxDays(), ai.available(), ReportAggregation.sections(principal));
    }

    public Detail create(UserPrincipal principal, Input input) {
        Long owner = owner(principal);
        var selected = EnumSet.copyOf(input.sections());
        if (input.mode() == Mode.STANDARD) selected.remove(Section.AI);
        if (input.mode() == Mode.AI_ENHANCED) selected.add(Section.AI);
        if (selected.stream().noneMatch(section -> section != Section.AI)) throw bad("Select at least one statistics section");
        if (!ReportAggregation.sections(principal).containsAll(selected)) throw new ResponseStatusException(FORBIDDEN);
        String fingerprint = fingerprint(input, selected);
        record Creation(Long id, boolean analyse) {}
        Creation created = inTransaction(() -> {
            if (entityManager.find(User.class, owner, LockModeType.PESSIMISTIC_WRITE) == null) throw missing();
            var previous = reports.findByOwnerIdAndRequestKey(owner, input.requestKey().toString()).orElse(null);
            if (previous != null) {
                if (!fingerprint.equals(previous.requestFingerprint)) throw conflict("Request key already used");
                return new Creation(previous.id, false);
            }
            ZoneId zone = habits.reportingZone();
            Instant now = Instant.now();
            var periodToDate = validatePeriod(input, LocalDate.ofInstant(now, zone), maxDays());
            Snapshot snapshot = aggregation.snapshot(principal, input, selected);
            var row = new LearningReport();
            row.ownerId = owner;
            row.requestKey = input.requestKey().toString();
            row.requestFingerprint = fingerprint;
            row.title = input.title().strip();
            row.type = input.type();
            row.periodStart = input.from();
            row.periodEnd = input.to();
            row.periodToDate = periodToDate;
            row.zone = zone.getId();
            row.mode = input.mode();
            row.language = input.language();
            row.sections = selected.stream().map(Enum::name).collect(Collectors.joining(","));
            row.generatedAt = now;
            row.updatedAt = now;
            row.schemaVersion = 1;
            row.snapshotJson = write(snapshot);
            row.aiStatus = selected.contains(Section.AI) ? AnalysisStatus.UNAVAILABLE : AnalysisStatus.NOT_REQUESTED;
            row.retryable = selected.contains(Section.AI);
            return new Creation(reports.saveAndFlush(row).id, row.retryable);
        });
        return created.analyse() && ai.available() ? retry(principal, created.id()) : detailRead(principal, created.id());
    }

    @Transactional(readOnly = true)
    public History history(UserPrincipal principal, Type type, LocalDate from, LocalDate to, int page, int size) {
        if (page < 0 || size < 1 || size > 50 || from != null && to != null && from.isAfter(to)) throw bad("Invalid history filters");
        Long owner = owner(principal);
        var order = Sort.by(Sort.Direction.DESC, "generatedAt", "id");
        var found = reports.search(owner, type, from == null ? LocalDate.of(1900,1,1) : from,
            to == null ? LocalDate.of(9999,12,31) : to, PageRequest.of(page, size, order));
        ZoneId zone = habits.reportingZone();
        var start = LocalDate.now(zone).withDayOfMonth(1).atStartOfDay(zone).toInstant();
        return new History(found.stream().map(this::item).toList(), found.getTotalElements(),
            reports.countByOwnerId(owner), reports.countByOwnerIdAndGeneratedAtGreaterThanEqual(owner, start),
            reports.findFirstByOwnerIdOrderByGeneratedAtDescIdDesc(owner).map(row -> row.generatedAt).orElse(null));
    }

    @Transactional(readOnly = true)
    public Detail detail(UserPrincipal principal, Long id) { return detailOwned(principal, owned(principal, id)); }

    @Transactional
    public Item rename(UserPrincipal principal, Long id, Title input) {
        var row = reports.lockOwned(id, owner(principal)).orElseThrow(ReportService::missing);
        row.title = input.title().strip();
        row.updatedAt = Instant.now();
        return item(row);
    }

    @Transactional
    public void delete(UserPrincipal principal, Long id) {
        reports.delete(reports.lockOwned(id, owner(principal)).orElseThrow(ReportService::missing));
    }

    public Detail retry(UserPrincipal principal, Long id) {
        record Job(Instant token, Language language, Snapshot snapshot) {}
        Job job = inTransaction(() -> {
            var row = reports.lockOwned(id, owner(principal)).orElseThrow(ReportService::missing);
            var detail = detailOwned(principal, row);
            if (row.mode != Mode.AI_ENHANCED) throw conflict("This report was generated in standard mode");
            if (detail.report().aiStatus() == AnalysisStatus.PENDING || row.aiStatus == AnalysisStatus.AVAILABLE || !ai.available()) return null;
            row.aiStatus = AnalysisStatus.PENDING;
            // Match JDBC timestamp precision when comparing the lease after the provider call.
            row.analysisStartedAt = Instant.now().truncatedTo(ChronoUnit.MILLIS);
            row.updatedAt = row.analysisStartedAt;
            return new Job(row.analysisStartedAt, row.language, detail.snapshot());
        });
        if (job == null) return detailRead(principal, id);
        Analysis result = null;
        try {
            result = ai.generate(owner(principal), job.language(), job.snapshot());
        } catch (RuntimeException failure) {
            log.warn("Personal learning report analysis failed ({})", failure.getClass().getSimpleName());
        }
        String analysis = result == null ? null : write(result);
        return inTransaction(() -> {
            var row = reports.lockOwned(id, owner(principal)).orElseThrow(ReportService::missing);
            if (job.token().equals(row.analysisStartedAt)) {
                row.analysisJson = analysis;
                row.aiStatus = analysis == null ? AnalysisStatus.UNAVAILABLE : AnalysisStatus.AVAILABLE;
                row.retryable = analysis == null;
                row.analysisStartedAt = null;
                row.updatedAt = Instant.now();
            }
            return detailOwned(principal, row);
        });
    }

    private Detail detailRead(UserPrincipal principal, Long id) {
        return inTransaction(() -> detailOwned(principal, owned(principal, id)));
    }

    private Detail detailOwned(UserPrincipal principal, LearningReport row) {
        Snapshot snapshot = read(row.snapshotJson, Snapshot.class);
        var required = item(row);
        boolean courseNames = snapshot.study() != null && snapshot.study().byCourse().stream().anyMatch(course -> course.courseId() != null);
        boolean progress = snapshot.overview() != null && snapshot.overview().enrolled() > snapshot.overview().unknown()
            || snapshot.courses() != null && snapshot.courses().stream().anyMatch(course -> !"UNKNOWN".equals(course.status()))
            || snapshot.roadmap() != null && snapshot.roadmap().completionRate() != null;
        if (!ReportAggregation.sections(principal).containsAll(required.sections())
            || courseNames && !ReportAggregation.has(principal, "COURSE_READ")
            || progress && (!ReportAggregation.has(principal, "LESSON_PROGRESS_READ")
                || !ReportAggregation.has(principal, "COURSE_READ"))) throw new ResponseStatusException(FORBIDDEN);
        return new Detail(required, snapshot, row.analysisJson == null ? null : read(row.analysisJson, Analysis.class),
            ReportAi.metrics(snapshot));
    }

    private Item item(LearningReport row) {
        var status = row.aiStatus;
        boolean stale = status == AnalysisStatus.PENDING && row.analysisStartedAt != null
            && row.analysisStartedAt.plus(LEASE).isBefore(Instant.now());
        var sections = Arrays.stream(row.sections.split(",")).map(Section::valueOf).collect(Collectors.toSet());
        return new Item(row.id, row.title, row.type, row.periodStart, row.periodEnd, row.zone, row.periodToDate,
            row.mode, row.language, sections, row.generatedAt, stale ? AnalysisStatus.UNAVAILABLE : status,
            row.retryable && (status == AnalysisStatus.UNAVAILABLE || stale));
    }

    static boolean validatePeriod(Input input, LocalDate today, int maxDays) {
        LocalDate from = input.from(), to = input.to();
        if (from.isBefore(LocalDate.of(1900,1,1)) || from.isAfter(to) || to.isAfter(today)
            || ChronoUnit.DAYS.between(from, to) >= maxDays) throw bad("Invalid reporting period");
        if (input.type() == Type.CUSTOM) return false;
        LocalDate first = switch (input.type()) {
            case WEEKLY -> from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTHLY -> from.withDayOfMonth(1);
            case QUARTERLY -> LocalDate.of(from.getYear(), ((from.getMonthValue() - 1) / 3) * 3 + 1, 1);
            default -> throw new IllegalStateException();
        };
        LocalDate last = switch (input.type()) {
            case WEEKLY -> first.plusDays(6);
            case MONTHLY -> first.plusMonths(1).minusDays(1);
            case QUARTERLY -> first.plusMonths(3).minusDays(1);
            default -> throw new IllegalStateException();
        };
        if (!from.equals(first) || !to.equals(last.isAfter(today) ? today : last)) throw bad("Dates do not match the selected period");
        return last.isAfter(today);
    }

    private int maxDays() { return Math.clamp(configuredMax, 1, 366); }
    private Long owner(UserPrincipal principal) { return principal.getUser().getId(); }
    private LearningReport owned(UserPrincipal principal, Long id) {
        return reports.findByIdAndOwnerId(id, owner(principal)).orElseThrow(ReportService::missing);
    }
    private <T> T inTransaction(Supplier<T> action) { return new TransactionTemplate(transactions).execute(status -> action.get()); }
    private String fingerprint(Input input, Set<Section> sections) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
                write(List.of(input.title().strip(), input.type(), input.from(), input.to(), input.mode(), input.language(), sections))
                    .getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
    private String write(Object data) {
        try { return mapper.writeValueAsString(data); }
        catch (JsonProcessingException failure) { throw new IllegalStateException("Could not encode report", failure); }
    }
    private <T> T read(String json, Class<T> type) {
        try { return mapper.readValue(json, type); }
        catch (JsonProcessingException failure) { throw new IllegalStateException("Could not read report", failure); }
    }
    static ResponseStatusException bad(String message) { return new ResponseStatusException(BAD_REQUEST, message); }
    private static ResponseStatusException conflict(String message) { return new ResponseStatusException(CONFLICT, message); }
    private static ResponseStatusException missing() { return new ResponseStatusException(NOT_FOUND, "Report not found"); }
}
