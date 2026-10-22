
package com.example.starter_project_2025.system.audit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.mockito.Mockito.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceImplTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private AuditDataSanitizer auditDataSanitizer;

    @InjectMocks
    private AuditLogServiceImpl auditLogService;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void log_shouldSaveAuditLogWithSystemActor() {

        when(auditDataSanitizer.sanitize(nullable(String.class)))
                .thenAnswer(invocation -> invocation.getArgument(0, String.class));

        auditLogService.log(
                "CREATE",
                "USER",
                "12",
                null,
                "{\"email\":\"test@example.com\"}",
                "request-001"
        );

        verify(auditLogRepository).save(argThat(log ->
                "SYSTEM".equals(log.getActorEmail())
                        && log.getActorId() == null
                        && "CREATE".equals(log.getAction())
                        && "USER".equals(log.getEntityType())
                        && "12".equals(log.getEntityId())
                        && "request-001".equals(log.getCorrelationId())
        ));
    }
}
