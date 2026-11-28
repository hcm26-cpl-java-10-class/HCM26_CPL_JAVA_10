package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.system.project.task.tag.Tag;
import org.mapstruct.*;

import java.util.List;
import java.util.Set;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface TaskMapper {

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "projectId", source = "projectId")
    @Mapping(target = "sprintId", source = "sprintId")
    @Mapping(target = "milestoneId", source = "milestoneId")
    @Mapping(target = "assigneeProjectMemberId", source = "assigneeProjectMemberId")
    @Mapping(target = "title", source = "title")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "estimatedHours", source = "estimatedHours")
    @Mapping(target = "deadline", source = "deadline")
    @Mapping(target = "priority", source = "priority")
    Task toEntity(TaskDTO request);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "sprintId", source = "sprintId")
    @Mapping(target = "milestoneId", source = "milestoneId")
    @Mapping(target = "assigneeProjectMemberId", source = "assigneeProjectMemberId")
    @Mapping(target = "title", source = "title")
    @Mapping(target = "description", source = "description")
    @Mapping(target = "estimatedHours", source = "estimatedHours")
    @Mapping(target = "deadline", source = "deadline")
    @Mapping(target = "priority", source = "priority")
    void update(@MappingTarget Task task, TaskDTO request);

    @Mapping(target = "backlogItemId", source = "backlogItem.id")
    TaskDTO toResponse(Task task);

    default List<String> mapTags(Set<Tag> tags) {
        return tags.stream().map(Tag::getName).sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

}
