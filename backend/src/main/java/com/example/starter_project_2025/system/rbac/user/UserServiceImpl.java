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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Pattern;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserServiceImpl
        extends BaseCrudServiceImpl<User, Long, UserDTO, UserFilter>
        implements UserService {

    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?\\d{8,15}$");

    UserMapper userMapper;
    UserRepository userRepository;
    RoleRepository roleRepository;
    PasswordEncoder passwordEncoder;

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
        return new String[]{"email", "username", "employeeCode", "firstName", "lastName"};
    }

    @Override
    protected void beforeCreate(User user, UserDTO request, ValidationContext ctx) {

        normalize(request);

        validateEmailUnique(request.getEmail(), null, ctx);
        validateUsernameUnique(request.getUsername(), null, ctx);
        validateEmployeeCodeUnique(request.getEmployeeCode(), null, ctx);
        validatePhone(request.getPhone(), ctx);
        validateRoles(request.getRoleIds(), ctx);

        user.setUsername(request.getUsername());
        user.setEmployeeCode(request.getEmployeeCode());
        user.setPhone(request.getPhone());
        user.setDescription(request.getDescription());

        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        user.setRoles(getRoles(request.getRoleIds()));
    }

    @Override
    protected void beforeUpdate(User user, UserDTO request, ValidationContext ctx) {

        normalize(request);

        if (request.getEmail() != null) {
            validateEmailUnique(request.getEmail(), user.getId(), ctx);
        }

        if (request.getUsername() != null) {
            validateUsernameUnique(request.getUsername(), user.getId(), ctx);
        }

        if (request.getEmployeeCode() != null) {
            validateEmployeeCodeUnique(request.getEmployeeCode(), user.getId(), ctx);
        }

        validatePhone(request.getPhone(), ctx);

        if (request.getRoleIds() != null) {
            validateRoles(request.getRoleIds(), ctx);
        }

        if (ctx.hasErrors()) {
            return;
        }

        if (request.getPassword() != null) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        if (request.getRoleIds() != null) {
            user.getRoles().clear();
            user.getRoles().addAll(getRoles(request.getRoleIds()));
        }

    }

    private void normalize(UserDTO request) {
        request.setUsername(trimToNull(request.getUsername()));
        request.setEmployeeCode(trimToNull(request.getEmployeeCode()));

        if (request.getEmail() != null) {
            request.setEmail(request.getEmail().trim());
        }
        if (request.getDescription() != null) {
            request.setDescription(request.getDescription().trim());
        }
        if (request.getPhone() != null) {
            request.setPhone(request.getPhone().replaceAll("[\\s.\\-]", ""));
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void validatePhone(String phone, ValidationContext ctx) {
        if (phone != null && !phone.isEmpty() && !PHONE_PATTERN.matcher(phone).matches()) {
            ctx.add("phone", "Phone number is invalid");
        }
    }

    private void validateEmailUnique(String email, Long currentUserId, ValidationContext ctx) {

        Optional<User> existing = userRepository.findByEmail(email);

        if (existing.isPresent()
                && (currentUserId == null || !existing.get().getId().equals(currentUserId))) {

            ctx.add("email", "Email is already in use");
        }
    }

    private void validateUsernameUnique(String username, Long currentUserId, ValidationContext ctx) {

        if (username == null) {
            return;
        }

        Optional<User> existing = userRepository.findByUsernameIgnoreCase(username);

        if (existing.isPresent()
                && (currentUserId == null || !existing.get().getId().equals(currentUserId))) {

            ctx.add("username", "Username is already in use");
        }
    }

    private void validateEmployeeCodeUnique(String employeeCode, Long currentUserId, ValidationContext ctx) {

        if (employeeCode == null) {
            return;
        }

        Optional<User> existing = userRepository.findByEmployeeCodeIgnoreCase(employeeCode);

        if (existing.isPresent()
                && (currentUserId == null || !existing.get().getId().equals(currentUserId))) {

            ctx.add("employeeCode", "Employee code is already in use");
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
    public void lockUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new com.example.starter_project_2025.exception.ResourceNotFoundException(
                                "User not found with id: " + userId
                        ));

        user.setLocked(true);
        userRepository.save(user);
    }

    @Override
    public void unlockUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new com.example.starter_project_2025.exception.ResourceNotFoundException(
                                "User not found with id: " + userId
                        ));

        user.setLocked(false);
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StudentSummaryDTO> findStudents() {
        return userRepository.findActiveUsersByRoleName("STUDENT").stream()
                .map(user -> new StudentSummaryDTO(
                        user.getId(),
                        user.getEmail(),
                        user.getFullName()
                ))
                .toList();
    }
}
