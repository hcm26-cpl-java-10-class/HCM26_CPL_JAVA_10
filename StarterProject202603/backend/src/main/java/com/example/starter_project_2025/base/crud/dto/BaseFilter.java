package com.example.starter_project_2025.base.crud.dto;

import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
public abstract class BaseFilter {

    @FilterField(entityField = "id", operator = FilterOperator.IN)
    List<Long> ids;

    @FilterField(entityField = "isActive")
    Boolean isActive;

    @FilterField(entityField = "createdAt", operator = FilterOperator.BETWEEN)
    List<LocalDateTime> createdRange;

    @FilterField(entityField = "updatedAt", operator = FilterOperator.BETWEEN)
    List<LocalDateTime> updatedRange;

    @FilterField(entityField = "createdBy")
    Long createdBy;

    @FilterField(entityField = "updatedBy")
    Long updatedBy;
}
