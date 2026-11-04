package com.example.starter_project_2025.system.project.report;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectReportExportRepository extends JpaRepository<ProjectReportExportJob,UUID> {
    Optional<ProjectReportExportJob> findByActorIdAndRequestId(Long actorId,UUID requestId);
    @Query("select j.id from ProjectReportExportJob j where j.status=:status order by j.createdAt,j.id")
    List<UUID> pending(ProjectReportExportJob.State status,org.springframework.data.domain.Pageable page);
    @Query("select j.id from ProjectReportExportJob j where (j.status=:ready and j.expiresAt<=:now) or (j.status=:running and j.startedAt<:stale)")
    List<UUID> stale(Instant now,Instant stale,ProjectReportExportJob.State ready,ProjectReportExportJob.State running);
    @Query("select j.id as id,j.status as status,j.format as format,j.fileName as fileName,j.createdAt as createdAt,j.generatedAt as generatedAt,"
            + "j.expiresAt as expiresAt,j.rowCount as rowCount,j.message as message from ProjectReportExportJob j "
            + "where j.actorId=:actor and j.tenantId=:tenant order by j.createdAt desc,j.id desc")
    List<Summary> summaries(Long actor,Long tenant,org.springframework.data.domain.Pageable page);
    interface Summary {
        UUID getId(); ProjectReportExportJob.State getStatus(); String getFormat(); String getFileName(); Instant getCreatedAt();
        Instant getGeneratedAt(); Instant getExpiresAt(); Long getRowCount(); String getMessage();
    }
}
