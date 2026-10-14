package com.example.starter_project_2025.system.demo.calendar_version;
import com.example.starter_project_2025.base.crud.mapper.*;
import org.mapstruct.*;
@Mapper(config = BaseMapperConfig.class)
public interface CalendarVersionMapper extends BaseCrudMapper<CalendarVersion, CalendarVersionDTO> {
    @Override
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "calendarId", source = "calendarId")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    CalendarVersion toEntity(CalendarVersionDTO dto);

    @Override
    @BeanMapping(ignoreByDefault = true, nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    void update(@MappingTarget CalendarVersion entity, CalendarVersionDTO dto);
}
