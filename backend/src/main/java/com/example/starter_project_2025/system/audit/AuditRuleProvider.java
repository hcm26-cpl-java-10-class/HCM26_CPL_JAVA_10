package com.example.starter_project_2025.system.audit;

import java.util.List;

/**
 * Extension point of the audit log.
 * Any module can contribute its own audit rules by exposing a Spring bean that implements this interface,
 * without touching the audit package or the audited services.
 */
public interface AuditRuleProvider {

    List<AuditRule> auditRules();
}
