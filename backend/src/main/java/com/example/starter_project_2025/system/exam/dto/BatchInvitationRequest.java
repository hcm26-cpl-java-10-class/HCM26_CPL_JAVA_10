package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class BatchInvitationRequest {

    @NotEmpty(groups = OnCreate.class, message = "At least one invitation is required")
    @Valid
    private List<InvitationCreateRequest> invitations;

    private boolean sendEmail = true;
}
