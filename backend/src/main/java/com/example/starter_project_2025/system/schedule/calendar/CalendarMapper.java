package com.example.starter_project_2025.system.schedule.calendar;

import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface CalendarMapper {

    @Mapping(target = "activeVersionNumber", ignore = true)
    CalendarSummaryResponse toSummaryResponse(Calendar calendar);


}
