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

    @JsonProperty(access = WRITE_ONLY)
    @Size(min = 8, groups = {OnCreate.class, OnUpdate.class}, message = "Password must be at least 8 characters long")
    String password;

    @NotBlank(groups = OnCreate.class, message = "First name is required")
    String firstName;

    String lastName;

    @NotEmpty(groups = OnCreate.class, message = "At least one role is required")
    Set<Long> roleIds;
}
