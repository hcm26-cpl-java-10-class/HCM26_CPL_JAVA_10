package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.Arrays;
import java.util.stream.Collectors;

/** Hibernate update does not widen an existing H2 varchar enum check constraint. */
@Component @RequiredArgsConstructor
public class LessonContentTypeSchemaUpdate implements ApplicationRunner {
    private final DataSource dataSource;
    private final JdbcTemplate jdbc;
    private final Environment environment;
    @Override public void run(ApplicationArguments arguments) throws Exception {
        if (!"update".equalsIgnoreCase(environment.getProperty("spring.jpa.hibernate.ddl-auto","update"))) return;
        try (var connection=dataSource.getConnection()) {
            if (!"H2".equals(connection.getMetaData().getDatabaseProductName())) return;
        }
        String schema=jdbc.queryForObject("select schema()",String.class);
        var checks=jdbc.queryForList("""
            select tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
            from INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            join INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
              on tc.CONSTRAINT_SCHEMA=cc.CONSTRAINT_SCHEMA and tc.CONSTRAINT_NAME=cc.CONSTRAINT_NAME
            where tc.TABLE_SCHEMA=? and tc.TABLE_NAME='LESSONS'
            """,schema);
        for (var check:checks) {
            String clause=String.valueOf(check.get("CHECK_CLAUSE"));
            if (!clause.matches("(?s)\"?CONTENT_TYPE\"?\\s+IN\\s*\\(.*\\)")
                    || !clause.contains("'VIDEO'") || !clause.contains("'TEXT'") || clause.contains("'ASSIGNMENT'")) continue;
            String table=quote(schema)+"."+quote("LESSONS");
            String allowed=Arrays.stream(LessonContentType.values()).map(type->"'"+type.name()+"'").collect(Collectors.joining(","));
            // Install the expanded check first so invalid content types remain blocked throughout.
            jdbc.execute("alter table "+table+" add constraint if not exists CK_LESSONS_ASSESSMENT_CONTENT_TYPES check (CONTENT_TYPE in ("+allowed+"))");
            jdbc.execute("alter table "+table+" drop constraint "+quote(String.valueOf(check.get("CONSTRAINT_NAME"))));
        }
    }
    private String quote(String identifier) { return "\""+identifier.replace("\"","\"\"")+"\""; }
}
