package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface SessionMapper extends BaseCrudMapper<Session, SessionDTO> {

    @Override
    @IgnoreAuditFields
    Session toEntity(SessionDTO dto);

    SessionDTO toDto(Session entity);
}
