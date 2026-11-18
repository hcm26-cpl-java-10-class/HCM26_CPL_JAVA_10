package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import java.util.Collection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectTeamMemberHistoryRepository
        extends BaseCrudRepository<ProjectTeamMemberHistory, Long> {

    @Query(
            value = """
                    select history
                    from ProjectTeamMemberHistory history
                    where history.classId in :classIds
                      and (:memberId is null or history.memberId = :memberId)
                      and (:teamId is null
                           or history.fromTeamId = :teamId
                           or history.toTeamId = :teamId)
                    order by history.createdAt desc, history.id desc
                    """,
            countQuery = """
                    select count(history)
                    from ProjectTeamMemberHistory history
                    where history.classId in :classIds
                      and (:memberId is null or history.memberId = :memberId)
                      and (:teamId is null
                           or history.fromTeamId = :teamId
                           or history.toTeamId = :teamId)
                    """
    )
    Page<ProjectTeamMemberHistory> findHistory(
            @Param("classIds") Collection<Long> classIds,
            @Param("memberId") Long memberId,
            @Param("teamId") Long teamId,
            Pageable pageable
    );
}
