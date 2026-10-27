package com.example.starter_project_2025.system.schedule;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Set;

/** Server configuration only; no production scope is selected until the owners agree. */
@Component
@ConfigurationProperties(prefix = "schedule.scoped")
public class ScheduleScopedSettings {
    private Set<ScheduleEntryKey.Source> sources = Set.of();

    public Set<ScheduleEntryKey.Source> getSources() { return sources; }
    public void setSources(Set<ScheduleEntryKey.Source> sources) { this.sources = Set.copyOf(sources); }
}
