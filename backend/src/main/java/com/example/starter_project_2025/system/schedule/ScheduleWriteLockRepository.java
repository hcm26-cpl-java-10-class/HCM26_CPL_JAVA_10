package com.example.starter_project_2025.system.schedule;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.Optional;

public interface ScheduleWriteLockRepository extends JpaRepository<ScheduleWriteLock, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ScheduleWriteLock l where l.id = 1")
    Optional<ScheduleWriteLock> acquire();
}
