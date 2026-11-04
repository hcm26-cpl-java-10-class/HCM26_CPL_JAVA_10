package com.example.starter_project_2025.system.project.report;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import static org.mockito.Mockito.*;

class ProjectReportExportDispatcherTest {
    @Test void sharedSchedulerOnlyDispatchesAndDoesNotQueueDuplicateBatches() {
        var jobs=mock(ProjectReportExportRepository.class);
        var service=mock(ProjectReportExportService.class);
        var executor=mock(ExecutorService.class);
        var id=UUID.randomUUID();
        when(jobs.pending(ProjectReportExportJob.State.QUEUED,PageRequest.of(0,5))).thenReturn(List.of(id));
        var dispatcher=new ProjectReportExportDispatcher(jobs,service,executor);
        dispatcher.dispatch();dispatcher.dispatch();
        var task=ArgumentCaptor.forClass(Runnable.class);
        verify(executor,times(1)).execute(task.capture());verifyNoInteractions(jobs,service);
        task.getValue().run();
        verify(service).expireAndRecover();verify(service).process(id);
        dispatcher.dispatch();verify(executor,times(2)).execute(any(Runnable.class));
    }
    @Test void failedBatchReleasesWorkerSoNextPollCanRetry() {
        var jobs=mock(ProjectReportExportRepository.class);
        var service=mock(ProjectReportExportService.class);
        var executor=mock(ExecutorService.class);
        doThrow(new IllegalStateException("Database temporarily unavailable")).when(service).expireAndRecover();
        var dispatcher=new ProjectReportExportDispatcher(jobs,service,executor);
        dispatcher.dispatch();
        var task=ArgumentCaptor.forClass(Runnable.class);verify(executor).execute(task.capture());task.getValue().run();
        dispatcher.dispatch();verify(executor,times(2)).execute(any(Runnable.class));
    }
}
