package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Mapper Entity <-> DTO cho ScheduleVersion.
 * Các trường computed (totalSessions, isEditable, editableMessage, previousActiveVersionId)
 * được set thủ công trong Service, không map qua MapStruct.
 */
@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface ScheduleVersionMapper extends BaseCrudMapper<ScheduleVersion, ScheduleVersionDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "clonedFromVersionId", ignore = true)
    @Mapping(target = "activatedAt", ignore = true)
    @Mapping(target = "activatedBy", ignore = true)
    ScheduleVersion toEntity(ScheduleVersionDTO dto);
}
