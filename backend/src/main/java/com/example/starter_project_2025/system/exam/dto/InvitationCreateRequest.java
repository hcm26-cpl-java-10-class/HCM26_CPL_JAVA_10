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

    private String expiresAt;
}
