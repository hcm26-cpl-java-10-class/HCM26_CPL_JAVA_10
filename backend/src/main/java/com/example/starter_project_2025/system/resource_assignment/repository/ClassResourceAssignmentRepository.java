package com.example.starter_project_2025.system.resource_assignment.repository;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.resource_assignment.domain.ClassResourceAssignment;
import com.example.starter_project_2025.system.resource_assignment.domain.ResourceType;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassResourceAssignmentRepository extends BaseCrudRepository<ClassResourceAssignment, Long> {

    boolean existsByClassIdAndResourceIdAndResourceType(Long classId, Long resourceId, ResourceType resourceType);

    List<ClassResourceAssignment> findByClassId(Long classId);
}