package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.auth.token.onetime.OneTimeTokenRepository;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.rbac.department.DepartmentRepository;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Manual account creation by an administrator (create form / POST /api/users). No email is sent. */
class UserServiceAccountTest {

    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        PasswordEncoder encoder = TestStubs.stub(PasswordEncoder.class, Map.of(
                "encode", args -> "HASH:" + args[0]));

        // Every role id in a request exists.
        RoleRepository roles = TestStubs.stub(RoleRepository.class, Map.of(
                "countByIdIn", args -> (long) ((Collection<?>) args[0]).size()));

        service = new UserServiceImpl(
                TestStubs.stub(UserMapper.class),
                TestStubs.stub(UserRepository.class),
                roles,
                TestStubs.stub(DepartmentRepository.class),
                TestStubs.stub(RefreshTokenRepository.class),
                TestStubs.stub(OneTimeTokenRepository.class),
                TestStubs.stub(CourseEnrollmentRepository.class),
                encoder);
    }

    private static UserDTO request(String password) {
        UserDTO request = new UserDTO();
        request.setEmail("new.user@example.com");
        request.setFirstName("New");
        request.setRoleIds(Set.of(1L));
        request.setPassword(password);
        return request;
    }

    @Test
    void passwordGiven_isHashed_andTheAccountIsReadyToUse() {
        User user = new User();
        ValidationContext ctx = new ValidationContext();

        service.beforeCreate(user, request("Hoa12345"), ctx);

        assertFalse(ctx.hasErrors());
        assertEquals("HASH:Hoa12345", user.getPasswordHash());
    }

    @Test
    void aBlankPassword_isRejected_becauseNoEmailCanCarryALink() {
        ValidationContext ctx = new ValidationContext();

        service.beforeCreate(new User(), request("   "), ctx);

        assertTrue(ctx.hasErrors());
    }

    @Test
    void aWeakPassword_isRejected() {
        ValidationContext ctx = new ValidationContext();

        service.beforeCreate(new User(), request("password123"), ctx);

        assertTrue(ctx.hasErrors());
    }

    @Test
    void anAdministratorChangingAPassword_clearsTheForcedChange() {
        User user = new User();
        user.setEmail("temp@example.com");
        user.setPasswordHash("HASH:temporary");
        user.setMustChangePassword(true);

        UserDTO request = new UserDTO();
        request.setPassword("Hoa12345");
        ValidationContext ctx = new ValidationContext();

        service.beforeUpdate(user, request, ctx);

        assertFalse(ctx.hasErrors());
        assertEquals("HASH:Hoa12345", user.getPasswordHash());
        assertFalse(user.getMustChangePassword());
    }
}
