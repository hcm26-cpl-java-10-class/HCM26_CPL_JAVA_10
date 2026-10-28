package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenRepository;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenRepository;
import com.example.starter_project_2025.system.auth.util.PasswordPolicy;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.rbac.department.Department;
import com.example.starter_project_2025.system.rbac.department.DepartmentRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Pattern;

@Slf4j
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
    DepartmentRepository departmentRepository;
    RefreshTokenRepository refreshTokenRepository;
    OneTimeTokenRepository oneTimeTokenRepository;
    CourseEnrollmentRepository courseEnrollmentRepository;
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
        return new String[]{"email", "firstName", "lastName"};
    }

    @Override
    protected void beforeCreate(User user, UserDTO request, ValidationContext ctx) {

        normalize(request);

        validateEmailUnique(request.getEmail(), null, ctx);
        validatePhone(request.getPhone(), ctx);
        validateRoles(request.getRoleIds(), ctx);

        user.setUsername(request.getUsername());
        user.setEmployeeCode(request.getEmployeeCode());
        // No email is sent when an account is created, so the administrator sets the initial password
        // and hands it to the person.
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            ctx.add("password", "Password is required");
        } else {
            validatePassword(request.getPassword(), ctx);
        }

        // Mapper đã map trước khi gọi hook, nên gán lại các giá trị đã chuẩn hóa.
        user.setPhone(request.getPhone());
        user.setDescription(request.getDescription());

        if (!ctx.hasErrors()) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        user.setRoles(getRoles(request.getRoleIds()));
    }

    @Override
    protected void beforeUpdate(User user, UserDTO request, ValidationContext ctx) {

        normalize(request);

        if (request.getEmail() != null) {
            validateEmailUnique(request.getEmail(), user.getId(), ctx);
        }

        validatePhone(request.getPhone(), ctx);

        if (request.getPassword() != null) {
            validatePassword(request.getPassword(), ctx);
        }

        if (request.getRoleIds() != null) {
            validateRoles(request.getRoleIds(), ctx);
        }

        // if (request.getDepartmentIds() != null) {
        //     validateDepartments(request.getDepartmentIds(), ctx);
        // }


        if (ctx.hasErrors()) {
            return;
        }


        if (request.getPassword() != null) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            user.setMustChangePassword(false);
        }

        if (request.getRoleIds() != null) {
            user.getRoles().clear();
            user.getRoles().addAll(getRoles(request.getRoleIds()));
        }

    }

    @Override
    protected void beforeDelete(User user) {

        // Còn dữ liệu nghiệp vụ gắn với user thì chặn xóa và báo rõ lý do (thay vì lỗi khóa ngoại).
        if (courseEnrollmentRepository.existsByUser_Id(user.getId())) {
            ValidationContext ctx = new ValidationContext();
            ctx.add("id", "Cannot delete a user who is enrolled in courses");
            ctx.throwIfErrors();
        }

        // Token đăng nhập / token một lần chỉ là dữ liệu phiên, xóa cùng user để không vướng khóa ngoại.
        refreshTokenRepository.deleteAllByUserId(user.getId());
        oneTimeTokenRepository.deleteAllByUserId(user.getId());
    }

    /** Trims the input values; a blank password means "not provided". */
    private void normalize(UserDTO request) {
        request.setPassword(trimToNull(request.getPassword()));

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

    private void validatePassword(String password, ValidationContext ctx) {
        String problem = PasswordPolicy.validate(password);
        if (problem != null) {
            ctx.add("password", problem);
        }
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

        // LOCKED = đang hoạt động nhưng bị khóa đăng nhập.
        user.setIsActive(true);
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

        // Mở khóa = trở lại ACTIVE (kể cả tài khoản cũ đang ở trạng thái ngưng hoạt động).
        user.setIsActive(true);
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
