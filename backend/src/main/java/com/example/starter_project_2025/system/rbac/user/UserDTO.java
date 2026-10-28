package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Set;
import java.util.UUID;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;
import static com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Email is required")
    @Email(groups = {OnCreate.class, OnUpdate.class}, message = "Email should be valid")
    @Size(max = 100, groups = {OnCreate.class, OnUpdate.class}, message = "Email must not exceed 100 characters")
    String email;

    @Size(max = 30, groups = {OnCreate.class, OnUpdate.class}, message = "Phone must not exceed 30 characters")
    String phone;

    @Size(max = 500, groups = {OnCreate.class, OnUpdate.class}, message = "Description must not exceed 500 characters")
    String description;

    /** Initial password set by the administrator (no email is sent). Strength is checked by PasswordPolicy. Blank on update = keep the current password. */
    @NotBlank(groups = OnCreate.class, message = "Password is required")
    @JsonProperty(access = WRITE_ONLY)
    String password;

    @NotBlank(groups = OnCreate.class, message = "First name is required")
    @Size(max = 100, groups = {OnCreate.class, OnUpdate.class}, message = "First name must not exceed 100 characters")
    String firstName;

    @Size(max = 100, groups = {OnCreate.class, OnUpdate.class}, message = "Last name must not exceed 100 characters")
    String lastName;

    @Size(max = 50, groups = {OnCreate.class, OnUpdate.class}, message = "Employee code must not exceed 50 characters")
    String employeeCode;

    String fullName;

    @NotEmpty(groups = OnCreate.class, message = "At least one role is required")
    Set<Long> roleIds;

    /** N-N user_departments; optional. On update: [] removes all departments, omitted keeps them. */
    Set<Long> departmentIds;

    /** Read-only: ACTIVE / LOCKED / INACTIVE, derived from isActive + locked. */
    @JsonProperty(access = READ_ONLY)
    String status;
}
