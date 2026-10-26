package com.example.starter_project_2025.system.invitation.controller;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.invitation.dto.InvitationDTO;
import com.example.starter_project_2025.system.invitation.dto.InvitationFilter;
import com.example.starter_project_2025.system.invitation.service.InvitationServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/invitations")
@RequiredArgsConstructor
public class InvitationController extends BaseCrudController<Long, InvitationDTO, InvitationFilter> {

    private final InvitationServiceImpl service;

    @Override
    protected BaseCrudService<Long, InvitationDTO, InvitationFilter> getService() {
        return service;
    }
}
