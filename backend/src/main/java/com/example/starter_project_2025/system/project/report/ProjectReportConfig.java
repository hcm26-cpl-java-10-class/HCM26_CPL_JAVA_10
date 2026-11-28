package com.example.starter_project_2025.system.project.report;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.Clock;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class ProjectReportConfig {
    @Bean("projectReportClock")
    public Clock projectReportClock() { return Clock.systemUTC(); }

    @Bean(name="projectReportExportExecutor",destroyMethod="shutdown")
    public ExecutorService projectReportExportExecutor() {
        return Executors.newSingleThreadExecutor(task -> {
            var thread=new Thread(task,"project-report-export");
            thread.setDaemon(true);
            return thread;
        });
    }
}
