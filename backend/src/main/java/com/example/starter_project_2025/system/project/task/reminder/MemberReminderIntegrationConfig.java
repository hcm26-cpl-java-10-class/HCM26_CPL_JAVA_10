package com.example.starter_project_2025.system.project.task.reminder;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.beans.factory.annotation.Value;
import javax.sql.DataSource;
import java.time.*;
import java.util.*;
@Configuration
public class MemberReminderIntegrationConfig {
    @Bean("memberReminderClock") public Clock memberReminderClock(){return Clock.systemUTC();}
    @Bean @ConditionalOnMissingBean(MemberContributionPort.class)
    public MemberContributionPort memberContributionPort(MemberReminderContributionMockRepository mocks,DataSource dataSource,
            Environment environment,@Value("${app.member-reminder.demo.enabled:true}") boolean demo) throws java.sql.SQLException {
        boolean local;
        try(var connection=dataSource.getConnection()){
            local=demo&&!environment.acceptsProfiles(Profiles.of("prod"))&&connection.getMetaData().getURL().startsWith("jdbc:h2:");
        }
        return (projectId,actors,now)->{
            Map<Long,Instant> latest=new HashMap<>();
            if(local)for(var row:mocks.findByProjectId(projectId))
                if(actors.contains(row.getActorId())&&!row.getOccurredAt().isAfter(now)
                        &&Set.of("ARTIFACT_SUBMITTED","ARTIFACT_UPDATED","CODE_COMMITTED").contains(row.getKind()))
                    latest.merge(row.getActorId(),row.getOccurredAt(),(a,b)->a.isAfter(b)?a:b);
            return latest;
        };
    }
}
