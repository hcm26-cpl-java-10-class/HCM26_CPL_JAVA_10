package com.example.starter_project_2025.system.trainer;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface TrainerRepository extends JpaRepository<Trainer, Long>, JpaSpecificationExecutor<Trainer> {
    boolean existsByTrainerCodeIgnoreCaseAndIdNot(String code, Long id);
    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Trainer t where t.id = :id and t.isActive = true")
    Optional<Trainer> findForUpdate(@Param("id") Long id);
    Optional<Trainer> findByIdAndIsActiveTrue(Long id);
    @Query("select (count(a) > 0) from TeachingAssignment a where a.trainerId = :id and a.trainerSource = 'INTERNAL'")
    boolean hasInternalAssignments(@Param("id") Long id);
    @Query("select (count(c) > 0) from TrainingOperationClass c where c.masterTrainerId = :id")
    boolean hasClasses(@Param("id") Long id);
}
