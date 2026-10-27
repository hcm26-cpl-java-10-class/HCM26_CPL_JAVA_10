package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnonymousSessionRequest {

    @NotBlank(message = "Access code is required")
    private String accessCode;

    @NotBlank(message = "Student name is required")
    @Size(max = 100, message = "Student name must not exceed 100 characters")
    private String studentName;

    @NotBlank(message = "Student email is required")
    @Email(message = "Invalid email format")
    @Size(max = 150, message = "Student email must not exceed 150 characters")
    private String studentEmail;

    private String fingerprint;
}
