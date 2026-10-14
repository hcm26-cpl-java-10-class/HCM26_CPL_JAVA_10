package com.example.starter_project_2025.system.demo.calendar;
import com.example.starter_project_2025.base.crud.mapper.*;
import org.mapstruct.*;

@Mapper(config = BaseMapperConfig.class)
public interface CalendarMapper extends BaseCrudMapper<TrainingCalendar, CalendarDTO> {
    @Override
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "classId", source = "classId")
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "classStartDate", source = "classStartDate")
    @Mapping(target = "classEndDate", source = "classEndDate")
    TrainingCalendar toEntity(CalendarDTO dto);

    @Override
    @BeanMapping(ignoreByDefault = true, nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "name", source = "name")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "classStartDate", source = "classStartDate")
    @Mapping(target = "classEndDate", source = "classEndDate")
    void update(@MappingTarget TrainingCalendar entity, CalendarDTO dto);
}
