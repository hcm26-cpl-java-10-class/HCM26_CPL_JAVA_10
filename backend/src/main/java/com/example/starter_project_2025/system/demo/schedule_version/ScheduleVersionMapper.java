package com.example.starter_project_2025.system.demo.schedule_version;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class, implementationName = "LegacyScheduleVersionMapperImpl")
public interface ScheduleVersionMapper extends BaseCrudMapper<ScheduleVersion, ScheduleVersionDTO> {

    @Override
    @IgnoreAuditFields
    ScheduleVersion toEntity(ScheduleVersionDTO dto);
}
