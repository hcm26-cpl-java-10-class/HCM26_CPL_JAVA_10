package com.example.starter_project_2025.system.project.sprint_backlog.key;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BacklogTaskKeySequenceRepository extends JpaRepository<BacklogTaskKeySequence, Long> {

    Optional<BacklogTaskKeySequence> findByTenantIdAndPrefix(Long tenantId, String prefix);

    /** Reserves {@code count} numbers; the row stays locked until the (short) transaction ends. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update BacklogTaskKeySequence s
               set s.nextNumber = s.nextNumber + :count, s.updatedAt = :now
             where s.tenantId = :tenantId and s.prefix = :prefix""")
    int reserve(@Param("tenantId") Long tenantId, @Param("prefix") String prefix,
                @Param("count") long count, @Param("now") LocalDateTime now);

    /** Moves the counter past numbers already taken (legacy backfill); never moves it back. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update BacklogTaskKeySequence s
               set s.nextNumber = :floor, s.updatedAt = :now
             where s.tenantId = :tenantId and s.prefix = :prefix and s.nextNumber < :floor""")
    int raiseTo(@Param("tenantId") Long tenantId, @Param("prefix") String prefix,
                @Param("floor") long floor, @Param("now") LocalDateTime now);

    @Query("select distinct s.prefix from BacklogTaskKeySequence s where s.tenantId = :tenantId order by s.prefix")
    List<String> findPrefixes(@Param("tenantId") Long tenantId);
}
