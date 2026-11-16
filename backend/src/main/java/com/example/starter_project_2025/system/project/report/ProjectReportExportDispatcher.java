package com.example.starter_project_2025.system.project.report;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

@Component @Slf4j
@ConditionalOnProperty(name="app.project-reports.export.worker-enabled",havingValue="true",matchIfMissing=true)
public class ProjectReportExportDispatcher {
    private final ProjectReportExportRepository jobs;
    private final ProjectReportExportService exports;
    private final ExecutorService executor;
    private final AtomicBoolean busy=new AtomicBoolean();

    public ProjectReportExportDispatcher(ProjectReportExportRepository jobs,ProjectReportExportService exports,
            @Qualifier("projectReportExportExecutor") ExecutorService executor) {
        this.jobs=jobs;
        this.exports=exports;
        this.executor=executor;
    }
    @Scheduled(fixedDelayString="${app.project-reports.export.poll-ms:2000}",initialDelayString="${app.project-reports.export.initial-delay-ms:5000}")
    public void dispatch() {
        if(!busy.compareAndSet(false,true))return;
        try {
            // File rendering runs on this feature's executor, leaving the shared scheduler free.
            executor.execute(() -> {
                try {
                    exports.expireAndRecover();
                    jobs.pending(ProjectReportExportJob.State.QUEUED,PageRequest.of(0,5)).forEach(exports::process);
                } catch(Exception failure) {
                    log.warn("Unable to process pending project report exports",failure);
                } finally {
                    busy.set(false);
                }
            });
        } catch(java.util.concurrent.RejectedExecutionException shuttingDown) {
            busy.set(false);
        }
    }
}
