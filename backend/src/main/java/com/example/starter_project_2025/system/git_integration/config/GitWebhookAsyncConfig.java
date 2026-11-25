package com.example.starter_project_2025.system.git_integration.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * SY-04: the dedicated pool that processes webhook events right after they are
 * stored ({@code @Async("gitWebhookTaskExecutor")}) and the tasks queued by the
 * fallback scheduler.
 * <p>
 * When the queue is full the task is <b>discarded</b>: the event is still RECEIVED
 * (or FAILED_RETRYABLE) in the database, so the fallback scheduler picks it up
 * later. Nothing is lost and a burst of deliveries never blocks the request thread.
 * <p>
 * The {@code taskExecutor} bean keeps every other {@code @Async} method of the
 * application where it runs today. The {@code projectReportExportExecutor} bean
 * already turns off Spring Boot's {@code applicationTaskExecutor}, so un-named
 * {@code @Async} calls run on a {@link SimpleAsyncTaskExecutor}. Without this bean
 * the webhook pool would become the only {@link TaskExecutor} and Spring would
 * pick it as the default for those calls too.
 */
@Slf4j
@Configuration
public class GitWebhookAsyncConfig {

    public static final String WEBHOOK_EXECUTOR = "gitWebhookTaskExecutor";

    @Bean(WEBHOOK_EXECUTOR)
    public ThreadPoolTaskExecutor gitWebhookTaskExecutor(GitHubAppProperties properties) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(properties.getWebhookWorkerCore());
        executor.setMaxPoolSize(properties.getWebhookWorkerMax());
        executor.setQueueCapacity(properties.getWebhookQueueCapacity());
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("git-webhook-");
        executor.setDaemon(true);
        executor.setRejectedExecutionHandler(new LoggingDiscardPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        return executor;
    }

    /** Unchanged default for the application's other {@code @Async} methods (see class comment). */
    @Bean("taskExecutor")
    public TaskExecutor taskExecutor() {
        return new SimpleAsyncTaskExecutor("app-async-");
    }

    /** {@link ThreadPoolExecutor.DiscardPolicy} that leaves a trace in the log. */
    static final class LoggingDiscardPolicy extends ThreadPoolExecutor.DiscardPolicy {
        @Override
        public void rejectedExecution(Runnable task, ThreadPoolExecutor pool) {
            log.warn("Webhook queue full ({} queued): task discarded, the fallback scheduler will pick the event up",
                    pool.getQueue().size());
            super.rejectedExecution(task, pool);
        }
    }
}
