package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingClass;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

import org.springframework.stereotype.Repository;

@Repository("trainingOperationsClassRepository")
public interface TrainingClassRepository extends JpaRepository<TrainingClass, Long>, JpaSpecificationExecutor<TrainingClass> {
    Optional<TrainingClass> findByIdAndIsActiveTrue(Long id);
    boolean existsByIdAndIsActiveTrue(Long id);
    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);
    @Query("select distinct c.program from TrainingOperationClass c where c.isActive = true and c.program is not null order by c.program")
    List<String> findPrograms();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from TrainingOperationClass c where c.id = :id and c.isActive = true")
    Optional<TrainingClass> findForUpdate(@Param("id") Long id);

    interface Statistics {
        long getTotalClasses();
        long getInProgress();
        long getUpcomingClasses();
        long getCompletedClasses();
    }

    @Query("""
        select count(c) as totalClasses,
          coalesce(sum(case when c.status = 'active' then 1 else 0 end), 0) as inProgress,
          coalesce(sum(case when c.status in ('planning', 'assigned')
            and c.startDate between :today and :through then 1 else 0 end), 0) as upcomingClasses,
          coalesce(sum(case when c.status in ('completed', 'closed') then 1 else 0 end), 0) as completedClasses
        from TrainingOperationClass c where c.isActive = true
        """)
    Statistics statistics(@Param("today") java.time.LocalDate today,
                          @Param("through") java.time.LocalDate through);
}
