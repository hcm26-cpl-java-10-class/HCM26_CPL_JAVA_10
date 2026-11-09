package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.rbac.location.Location;
import com.example.starter_project_2025.system.rbac.location.LocationRepository;
import com.example.starter_project_2025.system.rbac.location.LocationStatus;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

@Slf4j
@Order(4)
@Component
@RequiredArgsConstructor
public class LocationDataInitializer implements CommandLineRunner {

    private final LocationRepository locationRepository;
    private final UserRepository userRepository;
    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;

    @Override
    @Transactional
    public void run(String... args) {
        ensurePermissionsAndAssignToAdmin();

        Location root = ensure("VN_SYS", "Hệ thống Cơ sở Việt Nam", null);

        Location hn = ensure("CAMPUS_HN", "Cơ sở Hà Nội", root);
        Location hcm = ensure("CAMPUS_HCM", "Cơ sở TP. Hồ Chí Minh", root);
        Location dn = ensure("CAMPUS_DN", "Cơ sở Đà Nẵng", root);

        Location hnBuildingA = ensure("HN_BLD_A", "Tòa nhà A (Hà Nội)", hn);
        Location hnBuildingB = ensure("HN_BLD_B", "Tòa nhà B (Hà Nội)", hn);
        Location hcmBuildingAlpha = ensure("HCM_BLD_ALPHA", "Tòa nhà Alpha (HCM)", hcm);
        Location dnMain = ensure("DN_BLD_MAIN", "Tòa nhà Trung tâm Đà Nẵng", dn);

        Location hnA_F1 = ensure("HN_A_F1", "Tầng 1 - Lễ tân", hnBuildingA);
        Location hnA_F2 = ensure("HN_A_F2", "Tầng 2 - Ban Giám hiệu", hnBuildingA);
        Location hnB_F1 = ensure("HN_B_F1", "Tầng 1 - Khu Phòng Máy", hnBuildingB);
        Location hcmAlpha_F1 = ensure("HCM_ALP_F1", "Tầng 1 - Giảng đường", hcmBuildingAlpha);

        Location hnF2Office = ensure("HN_A_F2_OFFICE", "Văn phòng Ban Giám hiệu", hnA_F2);
        Location hnLab01 = ensure("HN_B_LAB01", "Phòng Máy tính Lab 01", hnB_F1);
        Location hcmR101 = ensure("HCM_ALP_R101", "Phòng học 101", hcmAlpha_F1);
        ensure("HCM_ALP_R102", "Phòng học 102", hcmAlpha_F1);

        assignUserToLocation("admin@example.com", hnF2Office);
        assignUserToLocation("teacher@example.com", hcmR101);
        assignUserToLocation("student@example.com", hnLab01);

        log.info("Ensured seed locations and user-location assignments successfully.");
    }

    private void ensurePermissionsAndAssignToAdmin() {
        List<String> actions = List.of("CREATE", "READ", "UPDATE", "DELETE");
        Role adminRole = roleRepository.findByName("ADMIN").orElse(null);

        for (String action : actions) {
            String permName = "LOCATION_" + action;
            Permission perm = permissionRepository.findByName(permName).orElseGet(() -> {
                Permission p = new Permission();
                p.setName(permName);
                p.setResource("LOCATION");
                p.setAction(action);
                p.setDescription("Auto generated permission for LOCATION " + action);
                return permissionRepository.save(p);
            });

            if (adminRole != null) {
                if (adminRole.getPermissions() == null) {
                    adminRole.setPermissions(new HashSet<>());
                }
                if (!adminRole.getPermissions().contains(perm)) {
                    adminRole.getPermissions().add(perm);
                }
            }
        }

        if (adminRole != null) {
            roleRepository.save(adminRole);
            log.info("Successfully assigned LOCATION permissions to ADMIN role.");
        }
    }

    private Location ensure(String code, String name, Location parent) {
        return locationRepository.findByCode(code).map(existing -> {
            existing.setParentLocation(parent);
            return locationRepository.save(existing);
        }).orElseGet(() -> {
            Location location = Location.builder()
                    .code(code)
                    .name(name)
                    .status(LocationStatus.ACTIVE)
                    .build();

            location.setParentLocation(parent);

            return locationRepository.save(location);
        });
    }

    private void assignUserToLocation(String email, Location location) {
        if (location == null) return;

        userRepository.findByEmail(email).ifPresent(user -> {
            location.addUser(user);
            locationRepository.save(location);
            log.info("Assigned user {} to location {}", email, location.getName());
        });
    }
}