package com.example.starter_project_2025.system.audit;

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
            LocalDate fromDate,
            LocalDate toDate,
            Pageable pageable
    ) {
        Specification<AuditLog> spec = Specification.where(null);

        if (actorName != null && !actorName.isBlank()) {
            String keyword = actorName.trim();
            List<Long> matchingUserIds =
                    userRepository.findIdsByActorName(keyword);

            spec = spec.and((root, query, cb) -> {
                String pattern = "%" + keyword.toLowerCase() + "%";

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