package com.example.starter_project_2025.system.schedule.session_audit;

import com.example.starter_project_2025.system.schedule.session_audit.dto.AuditLogQuery;
import com.example.starter_project_2025.system.schedule.session_audit.dto.AuditLogResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * T2 / UFR-SYS-014 — Tra cứu và export audit log (Admin/Auditor).
 *
 * <ul>
 *     <li>{@code GET /api/v1/audit-logs} — tra cứu có phân trang.</li>
 *     <li>{@code GET /api/v1/audit-logs/export} — export CSV.</li>
 * </ul>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/audit-logs")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Audit Log (UFR-SYS-014)",
        description = "Tra cứu/export nhật ký kiểm toán — chỉ Admin/Auditor")
public class SessionAuditLogController {

    SessionAuditService sessionAuditService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Tra cứu audit log",
            description = """
                    Lọc theo entityType, entityId, actorId, action, correlationId, from, to.
                    - 403 FORBIDDEN: không phải Admin/Auditor
                    """)
    public ResponseEntity<Page<AuditLogResponse>> search(@ModelAttribute AuditLogQuery query) {
        return ResponseEntity.ok(sessionAuditService.searchAuditLogs(query));
    }

    @GetMapping("/export")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "Export audit log (CSV)",
            description = """
                    Xuất tối đa 5000 dòng theo cùng điều kiện lọc.
                    - 403 FORBIDDEN: không phải Admin/Auditor
                    """)
    public ResponseEntity<byte[]> export(@ModelAttribute AuditLogQuery query) {
        String csv = sessionAuditService.exportAuditLogsCsv(query);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"session-audit-log.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
