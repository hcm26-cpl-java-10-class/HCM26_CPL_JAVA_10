package com.example.starter_project_2025.system.dashboard;

import com.example.starter_project_2025.system.menu.module.ModuleRepository;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroupRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final ModuleGroupRepository moduleGroupsRepository; // Sửa tên biến và kiểu cho đúng
    private final ModuleRepository moduleRepository;

    public DashboardStatsDTO getDashboardStats() {
        DashboardStatsDTO stats = new DashboardStatsDTO();

        stats.setTotalUsers(userRepository.count());
        stats.setTotalRoles(roleRepository.count());
        stats.setTotalMenus(moduleGroupsRepository.count());
        stats.setTotalMenuItems(moduleRepository.count());

        stats.setActiveUsers(userRepository.countByIsActive(true));
        stats.setActiveRoles(roleRepository.countByIsActive(true));
        stats.setActiveMenus(moduleGroupsRepository.findByIsActive(true).stream().count());

        return stats;
    }
}