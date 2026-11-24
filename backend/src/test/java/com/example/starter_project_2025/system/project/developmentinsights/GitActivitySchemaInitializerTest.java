package com.example.starter_project_2025.system.project.developmentinsights;

import com.example.starter_project_2025.system.project.developmentinsights.integration.GitActivitySchemaInitializer;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.*;

class GitActivitySchemaInitializerTest {
    @Test void ddlNoneMigrationIsIdempotentAndPreservesExistingApplicationData() throws Exception {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:git-schema-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        for (String table : List.of("projects", "users", "tenants", "sprint", "sprint_backlog")) {
            jdbc.execute("create table " + table + " (id bigint primary key, sentinel varchar(40))");
            jdbc.update("insert into " + table + " values (1, 'keep user data')");
        }
        var initializer = new GitActivitySchemaInitializer(dataSource);
        initializer.run(null);
        initializer.run(null);
        for (String table : List.of("projects", "users", "tenants", "sprint", "sprint_backlog")) {
            assertThat(jdbc.queryForObject("select sentinel from " + table + " where id=1", String.class)).isEqualTo("keep user data");
            assertThat(jdbc.queryForObject("select count(*) from information_schema.columns where table_schema='PUBLIC' and table_name=?", Integer.class, table.toUpperCase())).isEqualTo(2);
        }
        assertThat(jdbc.queryForObject("select count(*) from git_commits", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from git_activity_change", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from git_backlog_task_key", Integer.class)).isZero();
    }

    @Test void legacyKeysAndCounterAreCopiedWithoutChangingOrOverwritingTaskData() throws Exception {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:git-keys-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        for (String table : List.of("projects", "users", "tenants", "sprint")) {
            jdbc.execute("create table " + table + " (id bigint primary key)");
            jdbc.update("insert into " + table + " values(1)");
        }
        jdbc.execute("create table sprint_backlog(sprint_backlog_id bigint primary key, tenant_id bigint,task_key varchar(20),task_key_number bigint,title varchar(200))");
        jdbc.update("insert into sprint_backlog values(1,1,'FA-123',123,'keep this task')");
        var original = jdbc.queryForList("select * from sprint_backlog");
        var initializer = new GitActivitySchemaInitializer(dataSource);
        initializer.run(null);
        assertThat(jdbc.queryForObject("select task_key from git_backlog_task_key", String.class)).isEqualTo("FA-123");
        assertThat(jdbc.queryForObject("select next_number from git_task_key_sequence where tenant_id=1 and prefix='FA'", Long.class)).isEqualTo(124);
        jdbc.execute("create table backlog_task_key_sequence(tenant_id bigint,prefix varchar(8),next_number bigint)");
        jdbc.update("insert into backlog_task_key_sequence values(1,'FA',400)");
        jdbc.update("update git_backlog_task_key set task_key='FA-200',task_key_number=200 where sprint_backlog_id=1");
        initializer.run(null);
        initializer.run(null);
        assertThat(jdbc.queryForList("select * from sprint_backlog")).isEqualTo(original);
        assertThat(jdbc.queryForObject("select task_key from git_backlog_task_key", String.class)).isEqualTo("FA-200");
        assertThat(jdbc.queryForObject("select next_number from git_task_key_sequence where tenant_id=1 and prefix='FA'", Long.class)).isEqualTo(400);
        jdbc.update("delete from sprint_backlog where sprint_backlog_id=1");
        assertThat(jdbc.queryForObject("select count(*) from git_backlog_task_key", Integer.class)).isZero();
    }
}
