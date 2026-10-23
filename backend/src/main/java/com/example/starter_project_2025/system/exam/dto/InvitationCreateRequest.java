package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class InvitationCreateRequest {

    @NotNull(groups = OnCreate.class, message = "User ID is required")
    private Long userId;

    private String note;

    /** ISO-8601 datetime string (e.g. 2024-12-31T23:59) */
    private String expiresAt;
}
