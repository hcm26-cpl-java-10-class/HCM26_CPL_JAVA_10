package com.example.starter_project_2025.system.project.task.tag;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TagRepository extends BaseCrudRepository<Tag, UUID> {
    Optional<Tag> findByProjectIdAndNormalizedName(UUID projectId, String normalizedName);

    @Query("select distinct tag.name from ProjectTask task join task.tags tag "
            + "where task.projectId = :projectId and task.isActive = true "
            + "and (:creatorId is null or task.createdBy = :creatorId) order by tag.name")
    List<String> findNames(@Param("projectId") UUID projectId, @Param("creatorId") Long creatorId);
}
