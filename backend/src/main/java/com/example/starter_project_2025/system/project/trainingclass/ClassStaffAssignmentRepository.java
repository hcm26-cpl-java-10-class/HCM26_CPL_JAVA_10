package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignment;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffRoleType;
import org.springframework.stereotype.Repository;

@Repository
public interface ClassStaffAssignmentRepository
        extends BaseCrudRepository<ClassStaffAssignment, Long> {

    boolean existsByTrainingClass_IdAndUser_IdAndRoleType(
            Long classId,
            Long userId,
            ClassStaffRoleType roleType
    );
}