package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnonymousInvitationRequest {

    @NotBlank(groups = OnCreate.class, message = "Student name is required")
    @Size(max = 100, groups = OnCreate.class)
    private String studentName;

    @NotBlank(groups = OnCreate.class, message = "Student email is required")
    @Email(groups = OnCreate.class, message = "Invalid email format")
    private String studentEmail;

    private String note;

    /** ISO-8601 datetime string (e.g. 2024-12-31T23:59) */
    private String expiresAt;

    /** ISO-8601 datetime string (e.g. 2024-12-31T23:59) */
    private String maxAccessTime;

    @Min(value = 1, groups = OnCreate.class, message = "Max access attempts must be at least 1")
    @Max(value = 100, groups = OnCreate.class, message = "Max access attempts cannot exceed 100")
    private Integer maxAccessAttempts = 1;
}
