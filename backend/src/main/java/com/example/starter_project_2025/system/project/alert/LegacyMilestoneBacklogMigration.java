package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** Move unambiguous old alert selections to the canonical relation once, without overwriting an existing link. */
@Slf4j @Component @Order(100) @RequiredArgsConstructor
public class LegacyMilestoneBacklogMigration implements ApplicationRunner {
    private final AlertMilestoneConfigRepository configs;
    private final MilestoneRepository milestones;
    private final SprintBacklogRepository backlogs;
    private final ProjectAlertReadStore store;
    @Override @Transactional public void run(ApplicationArguments arguments) {
        var pending=configs.findAll().stream().filter(c->c.getMigratedAt()==null).toList();
        Map<Long,Set<UUID>> targets=new HashMap<>();
        pending.forEach(c->c.getBacklogItemIds().forEach(id->targets.computeIfAbsent(id,ignored->new HashSet<>()).add(c.getMilestoneId())));
        var teams=store.monitoringTeams();
        for(var config:pending) {
            var milestone=milestones.findById(config.getMilestoneId()).orElse(null);
            var team=teams.stream().filter(t->t.getId().equals(config.getTeamId())
                    &&t.getTrainingClass().getTenantId().equals(config.getTenantId())).findFirst().orElse(null);
            if(milestone!=null&&team!=null&&milestone.isActive()&&Objects.equals(milestone.getTeamId(),team.getId())
                    &&Objects.equals(milestone.getTenantId(),config.getTenantId())
                    &&(milestone.getProjectId()==null||Objects.equals(milestone.getProjectId(),team.getProjectId()))) {
                var scope=store.load(List.of(team));
                for(var item:backlogs.findAllById(config.getBacklogItemIds())) {
                    if(item.getMilestone()!=null)continue;
                    if(targets.get(item.getId()).size()==1&&Boolean.TRUE.equals(item.getIsActive())&&store.owner(scope,item)!=null)
                        item.setMilestone(milestone);
                    else log.warn("Legacy milestone link needs review: milestone={}, backlog={}",milestone.getId(),item.getId());
                }
            }
            config.setMigratedAt(Instant.now());
        }
    }
}
