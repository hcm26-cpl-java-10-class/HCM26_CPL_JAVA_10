package com.example.starter_project_2025.init;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.metamodel.EntityType;
import jakarta.persistence.metamodel.Metamodel;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Order(1)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PermissionInitializer implements CommandLineRunner {

    PermissionRepository permissionRepository;
    RoleRepository roleRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) {

        Metamodel metamodel = entityManager.getMetamodel();

        removeProjectTaskPermissions();

        for (EntityType<?> entity : metamodel.getEntities()) {

            Class<?> clazz = entity.getJavaType();

            if (clazz.isAnnotationPresent(ResourcePermission.class)) {
                generatePermissions(clazz);
            }
        }
    }

    private void removeProjectTaskPermissions() {
        Set<String> obsoletePermissions = Set.of("BOARD_READ", "TASK_CREATE", "TASK_UPDATE");
        var roles = roleRepository.findAll();

        for (Role role : roles) {
            if (role.getPermissions().removeIf(permission -> obsoletePermissions.contains(permission.getName()))) {
                roleRepository.save(role);
            }
        }

        for (String permissionName : obsoletePermissions) {
            permissionRepository.findByName(permissionName).ifPresent(permissionRepository::delete);
        }
    }

    private void generatePermissions(Class<?> entityClass) {

        ResourcePermission annotation =
                entityClass.getAnnotation(ResourcePermission.class);

        if (annotation == null) return;

        String resource = annotation.value();

        for (CrudAction action : CrudAction.values()) {

            String permissionName = resource + "_" + action.name();

            if (permissionRepository.existsByName(permissionName)) {
                continue;
            }

            Permission permission = Permission.builder()
                    .name(permissionName)
                    .resource(resource)
                    .action(action.name())
                    .description("Auto generated permission")
                    .build();

            permissionRepository.save(permission);
        }

    }

}
