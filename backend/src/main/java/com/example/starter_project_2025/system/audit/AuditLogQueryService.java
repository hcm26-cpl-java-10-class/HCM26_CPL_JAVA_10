
package com.example.starter_project_2025.system.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class AuditLogQueryService {

    private final AuditLogRepository repository;

    @Transactional(readOnly = true)
    public Page<AuditLogDTO> search(
            Long actorId,
            String action,
            String entityType,
            LocalDate fromDate,
            LocalDate toDate,
            Pageable pageable
    ) {
        Specification<AuditLog> spec = Specification.where(null);

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
}
