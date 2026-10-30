package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@DataJpaTest(properties = {"spring.jpa.hibernate.ddl-auto=create-drop", "spring.sql.init.mode=never"})
class DepartmentAssignmentTest {
    @Autowired UserRepository users;
    @Autowired DepartmentRepository departments;
    DepartmentServiceImpl service;

    @BeforeEach void setup() {
        service = new DepartmentServiceImpl(mock(DepartmentMapper.class), departments, users);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("authorized-test", null,
                        List.of(new SimpleGrantedAuthority("DEPARTMENT_DELETE"))));
    }

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    Department department(String code, String name) {
        return departments.saveAndFlush(Department.builder().code(code).name(name).build());
    }

    void user(String affiliation) {
        users.saveAndFlush(User.builder().email("assigned@example.com").passwordHash("test-hash")
                .firstName("Assigned").department(affiliation).build());
    }

    @Test void assignedByCodeCannotBeDeleted() {
        Department department = department("IT", "Information Technology");
        user(" it ");
        assertThrows(BusinessValidationException.class, () -> service.delete(department.getId()));
        assertTrue(departments.existsById(department.getId()));
    }

    @Test void assignedByNameCannotBeDeleted() {
        Department department = department("IT", "Information Technology");
        user(" information technology ");
        assertThrows(BusinessValidationException.class, () -> service.delete(department.getId()));
        assertTrue(departments.existsById(department.getId()));
    }

    @Test void unassignedDepartmentCanBeDeleted() {
        Department department = department("IT", "Information Technology");
        user("HR");
        service.delete(department.getId());
        departments.flush();
        assertFalse(departments.existsById(department.getId()));
    }

    @Test void queryUsesCurrentScalarModelAndDoesNotMatchOtherOrNullAffiliations() {
        department("IT", "Information Technology");
        user(null);
        assertFalse(users.existsByDepartmentCodeOrName("IT", "Information Technology"));
        User user = users.findByEmail("assigned@example.com").orElseThrow();
        user.setDepartment(" it ");
        users.saveAndFlush(user);
        assertTrue(users.existsByDepartmentCodeOrName("IT", "Information Technology"));
        assertFalse(users.existsByDepartmentCodeOrName("HR", "Human Resources"));
    }

    @Test void childDepartmentGuardRemainsActive() {
        Department parent = department("ROOT", "Root");
        departments.saveAndFlush(Department.builder().code("CHILD").name("Child")
                .parentDepartment(parent).build());
        assertThrows(BusinessValidationException.class, () -> service.delete(parent.getId()));
        assertTrue(departments.existsById(parent.getId()));
    }
}