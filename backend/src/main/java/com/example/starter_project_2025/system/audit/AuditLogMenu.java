package com.example.starter_project_2025.system.audit;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Audit Log",
        group = "RBAC Management",
        icon = "history",
        url = "/admin/audit-log",
        order = 4,
        permission = "USER_READ"
)
public class AuditLogMenu {
}