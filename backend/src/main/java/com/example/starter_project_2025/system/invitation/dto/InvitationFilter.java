package com.example.starter_project_2025.system.invitation.dto;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InvitationFilter extends BaseFilter {

    @FilterField(entityField = "exam.id", operator = FilterOperator.EQUAL)
    private Long examId;

    @FilterField(entityField = "user.id", operator = FilterOperator.EQUAL)
    private Long userId;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    private InvitationStatus status;

    @FilterField(entityField = "user.email", operator = FilterOperator.LIKE)
    private String userEmail;

    @FilterField(entityField = "exam.title", operator = FilterOperator.LIKE)
    private String examTitle;
}
