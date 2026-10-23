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
    String email;

    @NotBlank(groups = OnCreate.class, message = "Username is required")
    @Pattern(regexp = "^[A-Za-z0-9._-]{3,50}$", groups = {OnCreate.class, OnUpdate.class},
            message = "Username must be 3-50 characters: letters, digits, '.', '_' or '-'")
    String username;

    @NotBlank(groups = OnCreate.class, message = "Employee code is required")
    @Size(max = 50, groups = {OnCreate.class, OnUpdate.class}, message = "Employee code must not exceed 50 characters")
    String employeeCode;

    @Size(max = 30, groups = {OnCreate.class, OnUpdate.class}, message = "Phone must not exceed 30 characters")
    String phone;

    @Size(max = 500, groups = {OnCreate.class, OnUpdate.class}, message = "Description must not exceed 500 characters")
    String description;

    @NotBlank(groups = OnCreate.class, message = "Password is required")
    @JsonProperty(access = WRITE_ONLY)
    @Size(min = 8, groups = {OnCreate.class, OnUpdate.class}, message = "Password must be at least 8 characters long")
    String password;

    @NotBlank(groups = OnCreate.class, message = "First name is required")
    String firstName;

    String lastName;

    @NotEmpty(groups = OnCreate.class, message = "At least one role is required")
    Set<Long> roleIds;

    /** N-N user_departments; không bắt buộc. Gửi [] khi sửa = bỏ hết phòng ban, không gửi = giữ nguyên. */
    Set<Long> departmentIds;

    /** Chỉ đọc: ACTIVE / LOCKED / INACTIVE, suy ra từ isActive + locked. */
    @JsonProperty(access = READ_ONLY)
    String status;

    /**
     * Chỉ đọc: tài khoản "khách" được tạo tự động cho học sinh thi bằng link
     * anonymous (không có tài khoản RBAC thật).
     */
    @JsonProperty(access = READ_ONLY)
    Boolean isGuest;
}
