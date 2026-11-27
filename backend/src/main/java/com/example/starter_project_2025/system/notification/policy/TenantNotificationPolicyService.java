package com.example.starter_project_2025.system.notification.policy;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import com.example.starter_project_2025.system.notification.audit.NotificationAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TenantNotificationPolicyService {

    private static final int MAX_COOLDOWN_MINUTES = 10_080; // 7 days

    private final TenantNotificationPolicyRepository repository;

    @Autowired(required = false)
    private NotificationAuditService auditService;

    @Transactional(readOnly = true)
    public List<TenantNotificationPolicyDTO> getPolicies(Long tenantId) {
        long resolvedTenant = normalizeTenantId(tenantId);
        Map<NotificationCategory, TenantNotificationPolicy> byCategory = loadEffectiveMap(resolvedTenant);
        return Arrays.stream(NotificationCategory.values())
                .map(category -> toDto(category, byCategory.get(category)))
                .toList();
    }

    @Transactional(readOnly = true)
    public TenantNotificationPolicyDTO getEffectivePolicy(Long tenantId, NotificationCategory category) {
        long resolvedTenant = normalizeTenantId(tenantId);
        TenantNotificationPolicy policy = repository.findByTenantIdAndCategory(resolvedTenant, category)
                .orElseGet(() -> resolvedTenant == TenantNotificationPolicy.DEFAULT_TENANT_ID
                        ? null
                        : repository.findByTenantIdAndCategory(TenantNotificationPolicy.DEFAULT_TENANT_ID, category)
                                .orElse(null));
        return toDto(category, policy);
    }

    @Transactional(readOnly = true)
    public boolean isInAppMandatory(Long tenantId, NotificationCategory category) {
        return getEffectivePolicy(tenantId, category).inAppMandatory();
    }

    @Transactional(readOnly = true)
    public boolean isEmailMandatory(Long tenantId, NotificationCategory category) {
        return getEffectivePolicy(tenantId, category).emailMandatory();
    }

    @Transactional
    public List<TenantNotificationPolicyDTO> updatePolicies(
            Long tenantId,
            Long actorId,
            String actorEmail,
            List<TenantNotificationPolicyDTO> changes
    ) {
        long resolvedTenant = normalizeTenantId(tenantId);
        if (changes == null) {
            return getPolicies(resolvedTenant);
        }
        for (TenantNotificationPolicyDTO change : changes) {
            if (change == null || change.category() == null) {
                continue;
            }
            if (change.cooldownMinutes() < 0 || change.cooldownMinutes() > MAX_COOLDOWN_MINUTES) {
                throw new BadRequestException(
                        "Cooldown minutes must be between 0 and " + MAX_COOLDOWN_MINUTES
                );
            }
            TenantNotificationPolicy existing = repository
                    .findByTenantIdAndCategory(resolvedTenant, change.category())
                    .orElse(null);
            String beforeState = existing == null
                    ? "default"
                    : formatState(existing.isInAppMandatory(), existing.isEmailMandatory(), existing.getCooldownMinutes());

            TenantNotificationPolicy row = existing != null
                    ? existing
                    : TenantNotificationPolicy.builder()
                            .tenantId(resolvedTenant)
                            .category(change.category())
                            .build();
            row.setInAppMandatory(change.inAppMandatory());
            row.setEmailMandatory(change.emailMandatory());
            row.setCooldownMinutes(change.cooldownMinutes());
            row.setUpdatedByUserId(actorId);
            repository.save(row);

            if (auditService != null) {
                auditService.record(
                        resolvedTenant,
                        actorId,
                        actorEmail,
                        "POLICY_UPDATED",
                        "TenantNotificationPolicy",
                        resolvedTenant + ":" + change.category().name(),
                        beforeState,
                        formatState(row.isInAppMandatory(), row.isEmailMandatory(), row.getCooldownMinutes())
                );
            }
        }
        return getPolicies(resolvedTenant);
    }

    private Map<NotificationCategory, TenantNotificationPolicy> loadEffectiveMap(long resolvedTenant) {
        Map<NotificationCategory, TenantNotificationPolicy> map = new EnumMap<>(NotificationCategory.class);
        if (resolvedTenant != TenantNotificationPolicy.DEFAULT_TENANT_ID) {
            repository.findByTenantId(TenantNotificationPolicy.DEFAULT_TENANT_ID)
                    .forEach(p -> map.put(p.getCategory(), p));
        }
        repository.findByTenantId(resolvedTenant)
                .forEach(p -> map.put(p.getCategory(), p));
        return map;
    }

    private TenantNotificationPolicyDTO toDto(NotificationCategory category, TenantNotificationPolicy policy) {
        if (policy == null) {
            return new TenantNotificationPolicyDTO(category, false, false, 0);
        }
        return new TenantNotificationPolicyDTO(
                category,
                policy.isInAppMandatory(),
                policy.isEmailMandatory(),
                policy.getCooldownMinutes()
        );
    }

    private long normalizeTenantId(Long tenantId) {
        return tenantId == null ? TenantNotificationPolicy.DEFAULT_TENANT_ID : tenantId;
    }

    private String formatState(boolean inAppMandatory, boolean emailMandatory, int cooldownMinutes) {
        return "inAppMandatory=" + inAppMandatory
                + ",emailMandatory=" + emailMandatory
                + ",cooldownMinutes=" + cooldownMinutes;
    }
}
