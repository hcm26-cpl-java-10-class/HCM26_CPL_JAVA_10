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


        Location vn = ensure("VN", "Việt Nam (Hệ thống Cơ sở)", null);

        Location hn = ensure("CAMPUS_HN", "Cơ sở Hà Nội", vn);
        Location hcm = ensure("CAMPUS_HCM", "Cơ sở TP. Hồ Chí Minh", vn);
        Location dn = ensure("CAMPUS_DN", "Cơ sở Đà Nẵng", vn);

        Location hnBuildingA = ensure("HN_BUILDING_A", "Tòa nhà A (Hà Nội)", hn);
        Location hnBuildingB = ensure("HN_BUILDING_B", "Tòa nhà B (Hà Nội)", hn);

        ensure("HN_A_F1", "Tầng 1 - Lễ tân", hnBuildingA);
        Location hnF2 = ensure("HN_A_F2", "Văn phòng Ban Giám hiệu", hnBuildingA);
        Location hnLab01 = ensure("HN_A_LAB01", "Phòng Máy tính Lab 01", hnBuildingB);

        Location hcmBuildingAlpha = ensure("HCM_ALPHA", "Tòa nhà Alpha (HCM)", hcm);
        Location hcmR101 = ensure("HCM_ALP_R101", "Phòng học 101", hcmBuildingAlpha);
        ensure("HCM_ALP_R102", "Phòng học 102", hcmBuildingAlpha);

        ensure("DN_MAIN", "Tòa nhà Trung tâm Đà Nẵng", dn);


        assignUserToLocation("admin@example.com", hnF2);
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
        return locationRepository.findByCode(code).orElseGet(() -> {
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