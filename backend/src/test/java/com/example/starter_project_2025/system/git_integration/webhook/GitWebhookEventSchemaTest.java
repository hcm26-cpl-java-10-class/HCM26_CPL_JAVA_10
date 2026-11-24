package com.example.starter_project_2025.system.git_integration.webhook;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import org.springframework.context.ApplicationEventPublisher;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** SY-03: the manual deployment scripts run twice and reject a second row for the same delivery. */
class GitWebhookEventSchemaTest {

    @Test
    void anImmediatelyDueDeliveryRemainsDueAfterTheH2TimestampRoundTrip() {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:due-precision-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("create table deadlines (id bigint primary key, next_attempt_at timestamp(6))");
        var repository = org.mockito.Mockito.mock(GitWebhookEventRepository.class);
        org.mockito.Mockito.when(repository.saveAndFlush(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            GitWebhookEvent event = invocation.getArgument(0);
            event.setId(1L);
            jdbc.update("insert into deadlines values (?, ?)", event.getId(), event.getNextAttemptAt());
            return event;
        });
        Clock clock = Clock.fixed(Instant.parse("2026-11-17T10:00:00.123456789Z"), ZoneOffset.UTC);
        var store = new GitWebhookEventStore(repository, org.mockito.Mockito.mock(ApplicationEventPublisher.class),
                new GitHubAppProperties(), clock);
        store.insert(new GitWebhookEventStore.Incoming("precision-case", "push", null, null, null, null, null, null, "{}", 2, true));
        assertThat(jdbc.queryForObject("select count(*) from deadlines where next_attempt_at <= ?", Integer.class,
                LocalDateTime.now(clock))).as("a fresh delivery must not be rounded into the future").isEqualTo(1);
        jdbc.execute("shutdown");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", ";MODE=MySQL"})
    void scriptsAreRepeatableAndDeliveryIsUnique(String mode) throws Exception {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:sy3-schema-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1" + mode, "sa", "");
        var jdbc = new JdbcTemplate(dataSource);
        var script = new ResourceDatabasePopulator(new ClassPathResource(
                "db/manual/" + (mode.isEmpty() ? "git-webhook-events-h2.sql" : "git-webhook-events.sql")));
        script.execute(dataSource);
        script.execute(dataSource);

        String insert = "insert into git_webhook_events(is_active,created_at,updated_at,provider,delivery_id,event_type,payload,"
                + "payload_bytes,status,attempts,next_attempt_at,received_at) values (true,current_timestamp,current_timestamp,"
                + "'GITHUB',?,'push','{}',2,'RECEIVED',0,current_timestamp,current_timestamp)";
        jdbc.update(insert, "delivery-1");
        jdbc.update(insert, "delivery-2");
        assertThatThrownBy(() -> jdbc.update(insert, "delivery-1")).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select count(*) from git_webhook_events", Long.class)).isEqualTo(2);

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("shutdown");
        }
    }
}
