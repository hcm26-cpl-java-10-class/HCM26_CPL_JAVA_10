
package com.example.starter_project_2025.system.audit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class AuditLogIntegrationTest {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Test
    void shouldSaveAuditLogToDatabase() {

        AuditLog auditLog = AuditLog.builder()
                .actorId(1L)
                .actorEmail("admin@example.com")
                .action("CREATE")
                .entityType("USER")
                .entityId("12")
                .newValue("{\"email\":\"test@example.com\"}")
                .correlationId("request-001")
                .build();

        AuditLog saved = auditLogRepository.saveAndFlush(auditLog);

        assertNotNull(saved.getId());

        AuditLog found = auditLogRepository.findById(saved.getId())
                .orElseThrow();

        assertEquals("CREATE", found.getAction());
        assertEquals("USER", found.getEntityType());
        assertEquals(1L, found.getActorId());
        assertEquals("request-001", found.getCorrelationId());
    }
}
