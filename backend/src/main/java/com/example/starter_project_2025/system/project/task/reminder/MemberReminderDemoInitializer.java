package com.example.starter_project_2025.system.project.task.reminder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
@Slf4j @Component @Order(23) @Profile("!test & !prod") @RequiredArgsConstructor
@ConditionalOnProperty(name="app.member-reminder.demo.enabled",havingValue="true",matchIfMissing=true)
public class MemberReminderDemoInitializer implements CommandLineRunner {
    private final MemberReminderDemoDataService demo;
    private final DataSource dataSource;
    @Override public void run(String... args)throws Exception {
        try(var connection=dataSource.getConnection()){if(!connection.getMetaData().getURL().startsWith("jdbc:h2:"))return;}
        try{demo.seed();}catch(IllegalStateException exception){log.warn("Member reminder demo skipped: {}",exception.getMessage());}
    }
}
