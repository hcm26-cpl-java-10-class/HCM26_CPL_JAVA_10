package com.example.starter_project_2025.system.audit;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.util.List;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
public class AuditLogQueryService {

    private final AuditLogRepository repository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<AuditLogDTO> search(
            Long actorId,
            String actorName,
            String action,
            String entityType,
            String result,
            String keyword,
            LocalDate fromDate,
            LocalDate toDate,
            Pageable pageable
    ) {
        Specification<AuditLog> spec = Specification.where(null);

        if (keyword != null && !keyword.isBlank()) {
            String term = keyword.trim();
            String termPattern = "%" + term.toLowerCase() + "%";
            List<Long> matchingActorIds = userRepository.findIdsByActorName(term);
            Long numericTerm = parseLongOrNull(term);

            spec = spec.and((root, query, cb) -> {
                List<Predicate> predicates = new ArrayList<>();

                predicates.add(cb.like(cb.lower(root.get("actorEmail")), termPattern));
                predicates.add(cb.like(cb.lower(root.get("action")), termPattern));
                predicates.add(cb.like(cb.lower(root.get("entityType")), termPattern));
                predicates.add(cb.like(cb.lower(root.get("entityId")), termPattern));
                predicates.add(cb.like(cb.lower(root.get("correlationId")), termPattern));

                if (!matchingActorIds.isEmpty()) {
                    predicates.add(root.get("actorId").in(matchingActorIds));
                }

                if (numericTerm != null) {
                    predicates.add(cb.equal(root.get("actorId"), numericTerm));
                }

                return cb.or(predicates.toArray(new Predicate[0]));
            });
        }

        if (actorName != null && !actorName.isBlank()) {
            String nameTerm = actorName.trim();
            List<Long> matchingUserIds =
                    userRepository.findIdsByActorName(nameTerm);

            spec = spec.and((root, query, cb) -> {
                String pattern = "%" + nameTerm.toLowerCase() + "%";

                var actorNamePredicate = cb.or(
                        cb.like(cb.lower(root.get("actorEmail")), pattern),
                        cb.like(cb.lower(root.get("entityId")), pattern)
                );

                if (matchingUserIds.isEmpty()) {
                    return actorNamePredicate;
                }

                return cb.or(
                        root.get("actorId").in(matchingUserIds),
                        actorNamePredicate
                );
            });
        }

        if (actorId != null) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("actorId"), actorId));
        }

        if (action != null && !action.isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("action"), action));
        }

        if (entityType != null && !entityType.isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("entityType"), entityType));
        }

        if (result != null && !result.isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("result"), result));
        }

        if (fromDate != null) {
            spec = spec.and((root, query, cb) ->
                    cb.greaterThanOrEqualTo(
                            root.get("createdAt"),
                            fromDate.atStartOfDay()
                    ));
        }

        if (toDate != null) {
            spec = spec.and((root, query, cb) ->
                    cb.lessThan(
                            root.get("createdAt"),
                            toDate.plusDays(1).atStartOfDay()
                    ));
        }

        return repository.findAll(spec, pageable)
                .map(AuditLogDTO::fromEntity);
    }

    @Transactional(readOnly = true)
    public AuditStatsDTO getStats(LocalDate fromDate, LocalDate toDate) {
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDate lowerBound = fromDate != null ? fromDate : LocalDate.of(1970, 1, 1);

        List<Object[]> rows = repository.findStatsRows(
                lowerBound.atStartOfDay(),
                to.plusDays(1).atStartOfDay()
        );

        LocalDate from = fromDate;

        if (from == null) {
            from = rows.stream()
                    .map(row -> ((LocalDateTime) row[0]).toLocalDate())
                    .min(Comparator.naturalOrder())
                    .orElse(to.minusDays(29));
        }

        Map<LocalDate, long[]> days = new TreeMap<>();

        if (ChronoUnit.DAYS.between(from, to) <= 366) {
            for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
                days.put(day, new long[2]);
            }
        }

        Map<String, Long> byAction = new LinkedHashMap<>();
        Map<String, Long> byEntityType = new LinkedHashMap<>();
        Map<String, Long> byResult = new LinkedHashMap<>();
        Map<String, Long> byActor = new LinkedHashMap<>();
        long failures = 0;

        for (Object[] row : rows) {
            LocalDate day = ((LocalDateTime) row[0]).toLocalDate();
            String result = normalizeResult((String) row[3]);
            boolean failed = "FAILURE".equals(result);

            long[] counters = days.computeIfAbsent(day, key -> new long[2]);
            counters[0]++;

            if (failed) {
                counters[1]++;
                failures++;
            }

            byAction.merge(String.valueOf(row[1]), 1L, Long::sum);
            byEntityType.merge(String.valueOf(row[2]), 1L, Long::sum);
            byResult.merge(result, 1L, Long::sum);
            byActor.merge(row[4] != null ? String.valueOf(row[4]) : "SYSTEM", 1L, Long::sum);
        }

        List<AuditStatsDTO.DayBucket> byDay = days.entrySet().stream()
                .map(entry -> new AuditStatsDTO.DayBucket(
                        entry.getKey().toString(),
                        entry.getValue()[0],
                        entry.getValue()[1]))
                .toList();

        return new AuditStatsDTO(
                from.toString(),
                to.toString(),
                rows.size(),
                failures,
                byDay,
                toBuckets(byAction, 20),
                toBuckets(byEntityType, 10),
                toBuckets(byResult, 5),
                toBuckets(byActor, 5)
        );
    }

    private static String normalizeResult(String result) {
        if (result == null) {
            return "UNKNOWN";
        }

        String value = result.trim().toUpperCase();

        return "FAILED".equals(value) || "FAIL".equals(value) ? "FAILURE" : value;
    }

    private static List<AuditStatsDTO.Bucket> toBuckets(Map<String, Long> counts, int limit) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .map(entry -> new AuditStatsDTO.Bucket(entry.getKey(), entry.getValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public AuditLogFilterOptions getFilterOptions() {
        return new AuditLogFilterOptions(
                repository.findDistinctActions(),
                repository.findDistinctEntityTypes()
        );
    }

    private static Long parseLongOrNull(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public Page<AuditLogDTO> getEntityHistory(
            String entityType,
            String entityId,
            Pageable pageable
    ) {
        return repository
                .findByEntityTypeAndEntityId(entityType, entityId, pageable)
                .map(AuditLogDTO::fromEntity);
    }
}