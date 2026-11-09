package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignment;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffRoleType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassStaffAssignmentRepository
        extends BaseCrudRepository<ClassStaffAssignment, Long> {

    boolean existsByTrainingClass_IdAndUser_IdAndRoleType(
            Long classId,
            Long userId,
            ClassStaffRoleType roleType
    );

    boolean existsByTrainingClass_IdAndUser_IdAndRoleTypeAndIsActiveTrue(
            Long classId,
            Long userId,
            ClassStaffRoleType roleType
    );

    Optional<ClassStaffAssignment> findByTrainingClass_IdAndUser_IdAndRoleType(
            Long classId,
            Long userId,
            ClassStaffRoleType roleType
    );

    @EntityGraph(attributePaths = "user")
    List<ClassStaffAssignment> findAllByTrainingClass_IdAndRoleTypeAndIsActiveTrueOrderByUser_FirstNameAsc(
            Long classId,
            ClassStaffRoleType roleType
    );
}