package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.CrudAction;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class LocationSecurity {

    public void check(CrudAction action) {
        String permission = "LOCATION_" + action.name();
        boolean allowed = SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals(permission));
        if (!allowed) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Missing permission: " + permission
            );
        }
    }
}
