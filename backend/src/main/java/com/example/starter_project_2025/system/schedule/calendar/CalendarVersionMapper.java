package com.example.starter_project_2025.system.schedule.calendar;


import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface CalendarVersionMapper
        extends BaseCrudMapper<CalendarVersion, CalendarVersionResponse> {

    @Override
    @Mapping(target = "calendarId", source = "calendar.id")
    CalendarVersionResponse toResponse(CalendarVersion entity);

    @Override
    @IgnoreAuditFields
    @Mapping(target = "calendar", ignore = true)
    CalendarVersion toEntity(CalendarVersionResponse dto);
}
