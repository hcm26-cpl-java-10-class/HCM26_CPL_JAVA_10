package com.example.starter_project_2025.security;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

@Getter
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserPrincipal implements UserDetails {

    private User user;

    private Collection<? extends GrantedAuthority> authorities;

    public static UserPrincipal fromUser(User from) {

        Set<GrantedAuthority> authorities = new HashSet<>();

        for (Role role : from.getRoles()) {

            authorities.add(
                    new SimpleGrantedAuthority("ROLE_" + role.getName())
            );

            for (Permission permission : role.getPermissions()) {
                authorities.add(
                        new SimpleGrantedAuthority(permission.getName())
                );
            }
        }

        return new UserPrincipal(
                from,
                authorities
        );
    }

    @Override
    public String getPassword() {
        return this.getUser().getPasswordHash();
    }

    @Override
    public String getUsername() {
        return this.getUser().getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {return true;}

    @Override
    public boolean isAccountNonLocked() {
        return !Boolean.TRUE.equals(user.getLocked());
    }

    @Override
    public boolean isCredentialsNonExpired() {return true;}

    @Override
    public boolean isEnabled() {
        return Boolean.TRUE.equals(this.getUser().getIsActive());
    }
}
