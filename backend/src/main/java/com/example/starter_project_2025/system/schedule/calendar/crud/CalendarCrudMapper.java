package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.base.crud.mapper.*;
import org.mapstruct.*;

@Mapper(config = BaseMapperConfig.class)
public interface CalendarCrudMapper extends BaseCrudMapper<Calendar, CalendarDTO> {
    @Override
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "classId", source = "classId")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "classStartDate", source = "classStartDate")
    @Mapping(target = "classEndDate", source = "classEndDate")
    Calendar toEntity(CalendarDTO dto);

    @Override
    @BeanMapping(ignoreByDefault = true, nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "classStartDate", source = "classStartDate")
    @Mapping(target = "classEndDate", source = "classEndDate")
    void update(@MappingTarget Calendar entity, CalendarDTO dto);
}
