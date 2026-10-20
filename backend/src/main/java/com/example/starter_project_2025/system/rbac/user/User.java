package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.department.Department;
import com.example.starter_project_2025.system.rbac.role.Role;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "users")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("user")
@ExportEntity(fileName = "users", sheetName = "Users")
@ResourcePermission("USER")
@ResourceMenu(
        title = "Users",
        group = "RBAC Management",
        icon = "users",
        url = "/users",
        order = 1,
        permission = "USER_READ"
)
public class User extends BaseEntity {

    @Column(unique = true, nullable = false)
    @ImportField(name = "Email", required = true)
    @ExportField(name = "Email")
    String email;

    /** Export-only column. It is deliberately transient and always null; never expose passwordHash. */
    @Transient
    @ExportField(name = "password")
    String password;

    /**
     * Import: the "Password" column is optional. When it is empty the account is created with a random
     * password and the user receives an email to set their own. Passwords are never exported.
     */
    @Column(nullable = false)
    @ImportHash
    @ImportField(name = "Password")
    String passwordHash;

    @Column(nullable = false, length = 100)
    @ImportField(name = "First Name", required = true)
    @ExportField(name = "First Name")
    String firstName;

    @Column(length = 100)
    @ImportField(name = "Last Name")
    @ExportField(name = "Last Name")
    String lastName;

    @Column(length = 20)
    @ImportField(name = "Phone")
    @ExportField(name = "Phone")
    String phone;

    @Column(length = 500)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Builder.Default
    @Column(nullable = false)
    Boolean locked = false;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @ExportField(name = "Roles", relation = true, path = "name")
    @ImportField(name = "Roles", lookupEntity = Role.class, lookupField = "name", separator = ",")
    @JoinTable( name = "user_roles",
                joinColumns = @JoinColumn(name = "user_id"),
                inverseJoinColumns = @JoinColumn(name = "role_id"))
    Set<Role> roles = new HashSet<>();

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @ExportField(name = "Departments", relation = true, path = "code")
    @ImportField(name = "Departments", lookupEntity = Department.class, lookupField = "code", separator = ",")
    @JoinTable( name = "user_departments",
                joinColumns = @JoinColumn(name = "user_id"),
                inverseJoinColumns = @JoinColumn(name = "department_id"))
    Set<Department> departments = new HashSet<>();

    public String getFullName() {
        return firstName + (lastName != null ? " " + lastName : "");
    }
}
