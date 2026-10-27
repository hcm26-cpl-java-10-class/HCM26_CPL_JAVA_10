package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnonymousInvitationRequest {

    @Size(max = 100, message = "Student name must not exceed 100 characters")
    private String studentName;

    @Email(message = "Invalid email format")
    @Size(max = 150, message = "Student email must not exceed 150 characters")
    private String studentEmail;

    @Size(max = 500, message = "Note must not exceed 500 characters")
    private String note;

    private String expiresAt;

    private String maxAccessTime;

    @Min(value = 1, message = "Max access attempts must be at least 1")
    @Max(value = 100, message = "Max access attempts cannot exceed 100")
    private Integer maxAccessAttempts = 1;
}