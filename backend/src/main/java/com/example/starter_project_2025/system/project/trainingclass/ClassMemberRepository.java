package com.example.starter_project_2025.system.project.trainingclass;
import org.springframework.data.jpa.repository.EntityGraph;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassMemberRepository
        extends BaseCrudRepository<ClassMember, Long> {

    Optional<ClassMember> findByIdAndTrainingClass_Id(Long id, Long classId);
    Optional<ClassMember> findByTrainingClass_IdAndUser_Id(Long classId, Long userId);

    @EntityGraph(attributePaths = "user")
    List<ClassMember> findAllByTrainingClass_IdAndStatusOrderByIdAsc(
            Long classId,
            ClassMemberStatus status
    );

    List<ClassMember> findAllByTrainingClass_IdAndIdInAndStatus(
            Long classId,
            List<Long> memberIds,
            ClassMemberStatus status
    );

    boolean existsByTrainingClass_IdAndUser_Id(Long classId, Long userId);

    /**
     * Lấy mã Training Class theo User ID.
     * Student kế thừa User nên Student ID chính là User ID.
     */
    @Query("""
            select cm.user.id, cm.trainingClass.code
            from ClassMember cm
            where cm.user.id in :userIds
              and cm.status = :status
              and cm.isActive = true
              and cm.trainingClass.isActive = true
            order by cm.user.id, cm.trainingClass.code
            """)
    List<Object[]> findTrainingClassCodesByUserIds(
            @Param("userIds") List<Long> userIds,
            @Param("status") ClassMemberStatus status
    );

    long countByTrainingClass_Id(Long classId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select cm
            from ClassMember cm
            where cm.id in :memberIds
              and cm.trainingClass.id = :classId
              and cm.status = :status
            order by cm.id
            """)
    List<ClassMember> findAllByIdInAndStatusForUpdate(
            @Param("classId") Long classId,
            @Param("memberIds") List<Long> memberIds,
            @Param("status") ClassMemberStatus status
    );

}