package com.example.starter_project_2025.base.crud.mapper;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import org.mapstruct.BeanMapping;
import org.mapstruct.InheritConfiguration;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

public interface BaseCrudMapper<
        E extends BaseEntity,
        D extends BaseDTO> {

    @InheritConfiguration(name = "toEntityFromRegister")
    E toEntity(D dto);

    D toResponse(E entity);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget E entity, D dto);
}
