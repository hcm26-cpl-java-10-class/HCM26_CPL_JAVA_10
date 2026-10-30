package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/audit/enrollments", "/api/v1/audit/enrollments"})
@RequiredArgsConstructor
@ResourceMenu(
        title = "Enrollment Logs",
        url = "/enrollment-logs",
        icon = "clipboard-list",
        group = "Course Management", // Group này được hiển thị là "Course Online" trên Sidebar
        order = 6
)
public class EnrollmentAuditController {

    private final EnrollmentAuditService auditService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'TEACHER')")
    public ResponseEntity<Page<AuditLogRowDTO>> getAuditLogs(
            @ModelAttribute AuditLogFilterDTO filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(auditService.getAuditLogs(filter, PageRequest.of(page, size)));
    }
}
