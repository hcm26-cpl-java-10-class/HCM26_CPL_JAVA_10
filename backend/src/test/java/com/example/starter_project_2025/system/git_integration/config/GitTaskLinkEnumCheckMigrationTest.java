package com.example.starter_project_2025.system.git_integration.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** TM-03: enum check constraints written before the new values existed are dropped once. */
class GitTaskLinkEnumCheckMigrationTest {

    DriverManagerDataSource dataSource;
    JdbcTemplate jdbc;
    GitTaskLinkEnumCheckMigration migration;

    @BeforeEach
    void database() {
        dataSource = new DriverManagerDataSource("jdbc:h2:mem:tm3-checks-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        migration = new GitTaskLinkEnumCheckMigration(dataSource);
    }

    @AfterEach
    void shutdown() {
        jdbc.execute("shutdown");
    }

    @Test
    void outdatedChecksAreDroppedAndCurrentOnesKept() throws Exception {
        // As Hibernate created the table before TM-03.
        jdbc.execute("""
                create table backlog_reference(id bigint primary key,
                  status varchar(20) check (status in ('LINKED','INVALID','OUTSIDE_PROJECT','MISSING')),
                  reason varchar(20) check (reason in ('OK','NOT_FOUND','DELETED','OTHER_PROJECT','NO_TASK_ID')),
                  source_field varchar(10) check (source_field in ('MESSAGE','TITLE','BRANCH','BODY','NONE')),
                  source_type varchar(20) check (source_type in ('COMMIT','PULL_REQUEST')))""");
        jdbc.execute("create table backlog_git_link(id bigint primary key, "
                + "link_source varchar(20) check (link_source in ('AUTO','MANUAL')))");

        assertThat(migration.migrate()).hasSize(3);

        jdbc.update("insert into backlog_reference values (1, 'EXCLUDED', 'UNLINKED_BY_USER', 'MERGED_PR', 'COMMIT')");
        assertThat(checkCount("BACKLOG_REFERENCE")).isEqualTo(1); // source_type lists every value
        assertThat(checkCount("BACKLOG_GIT_LINK")).isEqualTo(1);
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void outdatedNativeEnumColumnsBecomeVarchar() throws Exception {
        // GI-06: Hibernate 6 declared the outcome as a native enum before ACCOUNT_LINKED existed.
        jdbc.execute("""
                create table git_oauth_states(id bigint primary key,
                  outcome enum('CONNECTED','DENIED','LINKED_ELSEWHERE'),
                  purpose enum('INSTALL','ACCOUNT_LINK'))""");

        assertThat(migration.migrate()).containsExactly("git_oauth_states.OUTCOME");

        jdbc.update("insert into git_oauth_states values (1, 'ACCOUNT_LINKED', 'ACCOUNT_LINK')");
        assertThat(jdbc.queryForObject("select outcome from git_oauth_states", String.class)).isEqualTo("ACCOUNT_LINKED");
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void syncJobsAcceptThePartialStatus() throws Exception {
        // SY-01: GI-04 created git_sync_jobs with native enums before PARTIAL existed.
        jdbc.execute("""
                create table git_sync_jobs(id bigint primary key,
                  type enum('INITIAL','MANUAL','SCHEDULED','WEBHOOK'),
                  status enum('PENDING','RUNNING','SUCCEEDED','FAILED'))""");

        assertThat(migration.migrate()).containsExactly("git_sync_jobs.STATUS");

        jdbc.update("insert into git_sync_jobs values (1, 'INITIAL', 'PARTIAL')");
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void commitsAcceptTheGraphQlHistorySource() throws Exception {
        // SY-01: SY-04 created git_commits.source as VARCHAR, but Hibernate still wrote a CHECK of its values.
        jdbc.execute("""
                create table git_commits(id bigint primary key, sha varchar(64),
                  source varchar(20) not null check (source in ('WEBHOOK_PAYLOAD','COMPARE_API','LIST_COMMITS_API')))""");

        assertThat(migration.migrate()).hasSize(1);

        jdbc.update("insert into git_commits values (1, 'abc', 'GRAPHQL_HISTORY')");
        assertThat(checkCount("GIT_COMMITS")).isZero();
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void syncJobsAcceptThePullRequestPhase() throws Exception {
        // SY-02: SY-01 created git_sync_jobs.phase as VARCHAR with a CHECK of METADATA, COMMITS, DONE
        // (the exact clause found on the real database).
        jdbc.execute("create table git_sync_jobs(id bigint primary key, "
                + "phase varchar(30) check (phase in ('METADATA','COMMITS','DONE')))");

        assertThat(migration.migrate()).hasSize(1);

        jdbc.update("insert into git_sync_jobs values (1, 'PULL_REQUESTS')");
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void installationsAcceptTheErrorStatus() throws Exception {
        // GI-02: GI-01 created git_installations.status as a native enum (as found on the real database).
        jdbc.execute("create table git_installations(id bigint primary key, "
                + "status enum('CONNECTED','SUSPENDED','DISCONNECTED') not null)");

        assertThat(migration.migrate()).containsExactly("git_installations.STATUS");

        jdbc.update("insert into git_installations values (1, 'ERROR')");
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void historicalActivityReviewsArePreservedWhenPendingBecomesAvailable() throws Exception {
        jdbc.execute("create table pull_request_review(id bigint primary key, "
                + "state enum('APPROVED','CHANGES_REQUESTED','COMMENTED','DISMISSED') not null)");
        jdbc.update("insert into pull_request_review values (1, 'APPROVED')");
        assertThat(migration.migrate()).containsExactly("pull_request_review.STATE");
        jdbc.update("insert into pull_request_review values (2, 'PENDING')");
        assertThat(jdbc.queryForList("select state from pull_request_review order by id", String.class))
                .containsExactly("APPROVED", "PENDING");
        assertThat(migration.migrate()).isEmpty();
    }

    @Test
    void newDatabasesAreLeftAlone() throws Exception {
        assertThat(migration.migrate()).isEmpty(); // no table yet
    }

    @Test
    void aClauseIsJudgedByTheColumnItNames() {
        var columns = GitTaskLinkEnumCheckMigration.ENUM_COLUMNS.get("backlog_reference");
        assertThat(GitTaskLinkEnumCheckMigration.outdated("(\"SOURCE_TYPE\" IN('COMMIT', 'PULL_REQUEST'))", columns)).isFalse();
        assertThat(GitTaskLinkEnumCheckMigration.outdated("(`status` in (_utf8mb4'LINKED',_utf8mb4'MISSING'))", columns)).isTrue();
        assertThat(GitTaskLinkEnumCheckMigration.outdated("(\"ID\" > 0)", columns)).isFalse();
    }

    private int checkCount(String table) {
        Integer count = jdbc.queryForObject("select count(*) from information_schema.table_constraints "
                + "where constraint_type = 'CHECK' and table_name = ?", Integer.class, table);
        return count == null ? 0 : count;
    }
}
