package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserServiceImpl
        extends BaseCrudServiceImpl<User, Long, UserDTO, UserFilter>
        implements UserService {

    UserMapper userMapper;
    UserRepository userRepository;
    RoleRepository roleRepository;
    PasswordEncoder passwordEncoder;
    RefreshTokenService refreshTokenService;

    @Override
    protected BaseCrudRepository<User, Long> getRepository() {
        return userRepository;
    }

    @Override
    protected BaseCrudMapper<User, UserDTO> getMapper() {
        return userMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"email", "firstName", "lastName"};
    }

    @Override
    protected void beforeCreate(User user, UserDTO request, ValidationContext ctx) {

        validateEmailUnique(request.getEmail(), null, ctx);
        validateRoles(request.getRoleIds(), ctx);

        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        Set<Role> roles = getRoles(request.getRoleIds());
        user.setRoles(roles);
    }

    @Override
    protected void beforeUpdate(User user, UserDTO request, ValidationContext ctx) {

        if (request.getStatus() != null && request.getStatus() != user.getStatus()) {
            String error = statusChangeError(user, request.getStatus());
            if (error != null) {
                ctx.add("status", error);
            } else {
                applyStatus(user, request.getStatus(), request.getStatusReason());
            }
        }

        if (request.getEmail() != null) {
            validateEmailUnique(request.getEmail(), user.getId(), ctx);
        }

        if (request.getRoleIds() != null) {
            validateRoles(request.getRoleIds(), ctx);
        }

        if (request.getPassword() != null) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        if (request.getRoleIds() != null) {

            Set<Role> roles = getRoles(request.getRoleIds());

            user.getRoles().clear();
            user.getRoles().addAll(roles);
        }
    }

    private void validateEmailUnique(String email, Long currentUserId, ValidationContext ctx) {

        Optional<User> existing = userRepository.findByEmail(email);

        if (existing.isPresent()
                && (currentUserId == null || !existing.get().getId().equals(currentUserId))) {

            ctx.add("email", "Email is already in use");
        }
    }

    private void validateRoles(Set<Long> roleIds, ValidationContext ctx) {

        if (roleIds == null || roleIds.isEmpty()) {
            ctx.add("roleIds", "At least one role must be assigned");
            return;
        }

        long found = roleRepository.countByIdIn(roleIds);

        if (found != roleIds.size()) {
            ctx.add("roleIds", "One or more roles are invalid");
        }
    }

    private Set<Role> getRoles(Set<Long> roleIds) {
        return new HashSet<>(roleRepository.findAllById(roleIds));
    }

    @Override
    public void changeStatus(Long userId, UserStatus target, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (user.getStatus() == target) {
            return;
        }

        String error = statusChangeError(user, target);
        if (error != null) {
            throw new BadRequestException(error);
        }

        applyStatus(user, target, reason);
        userRepository.save(user);
    }

    private String statusChangeError(User user, UserStatus target) {
        if (target == UserStatus.INVITED) {
            return "Status INVITED cannot be set manually";
        }
        if (target != UserStatus.ACTIVE && isCurrentUser(user.getId())) {
            return "You cannot suspend or deactivate your own account";
        }
        return null;
    }

    private void applyStatus(User user, UserStatus target, String reason) {
        user.setStatus(target);
        user.setStatusReason(target == UserStatus.ACTIVE ? null : reason);
        if (target != UserStatus.ACTIVE) {
            refreshTokenService.revokeAllRefreshTokens(user.getId());
        }
    }

    private boolean isCurrentUser(Long userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null
                && auth.getPrincipal() instanceof UserPrincipal me
                && me.getUser().getId().equals(userId);
    }
}
