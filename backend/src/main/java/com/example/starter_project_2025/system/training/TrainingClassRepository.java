package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingClass;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface TrainingClassRepository extends JpaRepository<TrainingClass, Long>, JpaSpecificationExecutor<TrainingClass> {
    Optional<TrainingClass> findByIdAndIsActiveTrue(Long id);
    boolean existsByIdAndIsActiveTrue(Long id);
    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);
    @Query("select distinct c.program from TrainingClass c where c.isActive = true and c.program is not null order by c.program")
    List<String> findPrograms();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from TrainingClass c where c.id = :id and c.isActive = true")
    Optional<TrainingClass> findForUpdate(@Param("id") Long id);
}
