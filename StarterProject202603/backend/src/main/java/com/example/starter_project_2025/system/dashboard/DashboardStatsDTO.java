package com.example.starter_project_2025.system.dashboard;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourceMenu(
        title = "Dashboard Stats",
        group = "Dashboard",
        icon = "dashboard",
        url = "/dashboard",
    order = 1,
    permission = "USER_READ"
)
public class DashboardStatsDTO {
    Long totalUsers;
    Long totalRoles;
    Long totalMenus;
    Long totalMenuItems;
    Long activeUsers;
    Long activeRoles;
    Long activeMenus;
}
