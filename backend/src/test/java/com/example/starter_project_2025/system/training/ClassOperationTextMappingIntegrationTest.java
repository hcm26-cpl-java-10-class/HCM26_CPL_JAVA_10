package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.ClassOperationEntity;
import com.example.starter_project_2025.system.training.entity.ClassTopicAssessmentEntity;
import com.example.starter_project_2025.system.training.entity.TrainingCalendar;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import org.hibernate.SessionFactory;
import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.cfg.Configuration;
import org.hibernate.tool.schema.spi.SchemaManagementException;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Validates the existing H2 TEXT/VARCHAR schema without application initializers. */
class ClassOperationTextMappingIntegrationTest {
    private static final String LEGACY_JSON = "[{\"name\":\"Existing milestone\",\"weight\":100}]";

    @Test
    void validatesExistingVarcharColumnAndPreservesExistingJson() throws Exception {
        String url = createExistingSchema();

        try (SessionFactory factory = validateMapping(url, ClassOperationEntity.class,
                ClassTopicAssessmentEntity.class, TrainingCalendar.class);
             var session = factory.openSession()) {
            ClassOperationEntity existing = session.find(ClassOperationEntity.class, 1L);
            assertEquals(7L, existing.getClassId());
            assertEquals(LEGACY_JSON, existing.getMilestonesJson());
        }

        try (var connection = DriverManager.getConnection(url, "sa", "");
             var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH "
                     + "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='CLASS_OPERATIONS' "
                     + "AND COLUMN_NAME='MILESTONES_JSON'")) {
            assertTrue(rows.next());
            assertEquals("CHARACTER VARYING", rows.getString(1));
            assertEquals(1_000_000_000L, rows.getLong(2));
        }
    }

    @Test
    void roundTripsLargeUnicodeJsonAndNullThroughExistingTextColumn() throws Exception {
        String url = createExistingSchema();
        String largeJson = "{\"note\":\"" + "Đào tạo 🚀 ".repeat(20_000)
                + "\",\"milestones\":[{\"name\":\"Kết thúc\"}]}";
        Long largeId;
        Long nullId;

        try (SessionFactory factory = validateMapping(url, ClassOperationEntity.class)) {
            try (var session = factory.openSession()) {
                var transaction = session.beginTransaction();
                var large = ClassOperationEntity.builder().classId(8L).milestonesJson(largeJson).build();
                var empty = ClassOperationEntity.builder().classId(9L).build();
                session.persist(large);
                session.persist(empty);
                transaction.commit();
                largeId = large.getId();
                nullId = empty.getId();
            }
            try (var session = factory.openSession()) {
                assertEquals(largeJson, session.find(ClassOperationEntity.class, largeId).getMilestonesJson());
                assertNull(session.find(ClassOperationEntity.class, nullId).getMilestonesJson());
                assertEquals(LEGACY_JSON, session.find(ClassOperationEntity.class, 1L).getMilestonesJson());
            }
        }
    }

    @Test
    void legacyLobMappingReproducesClobValidationFailure() throws Exception {
        String url = createExistingSchema();
        SchemaManagementException error = assertThrows(SchemaManagementException.class,
                () -> validateMapping(url, LegacyLobMapping.class));
        assertTrue(error.getMessage().contains("milestones_json"));
        assertTrue(error.getMessage().contains("Types#CLOB"));
    }

    @Test
    void roundTripsLargeUnicodeAssessmentJsonThroughExistingTextColumn() throws Exception {
        String url = createExistingSchema();
        String json = largeUnicodeJson();
        Long id;
        try (SessionFactory factory = validateMapping(url, ClassTopicAssessmentEntity.class)) {
            try (var session = factory.openSession()) {
                var transaction = session.beginTransaction();
                var assessment = ClassTopicAssessmentEntity.builder().classId(7L).topicIndex(0)
                        .title("Mapping verification").assessmentsJson(json).build();
                session.persist(assessment);
                transaction.commit();
                id = assessment.getId();
            }
            try (var session = factory.openSession()) {
                assertEquals(json, session.find(ClassTopicAssessmentEntity.class, id).getAssessmentsJson());
            }
        }
    }

    @Test
    void roundTripsLargeUnicodeCalendarJsonThroughExistingLongtextColumns() throws Exception {
        String url = createExistingSchema();
        String json = largeUnicodeJson();
        Long id;
        try (SessionFactory factory = validateMapping(url, TrainingCalendar.class)) {
            try (var session = factory.openSession()) {
                var transaction = session.beginTransaction();
                var calendar = new TrainingCalendar();
                calendar.setClassId(7L);
                calendar.setRevision(1);
                calendar.setName("Mapping verification");
                calendar.setHistoryChange("Test-only calendar");
                calendar.setModifiedBy("mapping-test");
                calendar.setSchedule(json);
                calendar.setTopicsJson(json);
                calendar.setClassStartDate(LocalDate.of(2026, 1, 1));
                calendar.setActualLearningStartDate(LocalDate.of(2026, 1, 1));
                session.persist(calendar);
                transaction.commit();
                id = calendar.getId();
            }
            try (var session = factory.openSession()) {
                var calendar = session.find(TrainingCalendar.class, id);
                assertEquals(json, calendar.getSchedule());
                assertEquals(json, calendar.getTopicsJson());
                assertEquals("mapping-test", calendar.getLastModifiedBy());
                assertNotNull(calendar.getLastModifiedDate());
                assertNotNull(calendar.getCreatedAt());
                assertNotNull(calendar.getUpdatedAt());
                assertTrue(calendar.getIsActive());
            }
        }
    }

    private static String largeUnicodeJson() {
        return "[{\"name\":\"" + "Đào tạo 🚀 ".repeat(20_000) + "\"}]";
    }

    private static SessionFactory validateMapping(String url, Class<?>... entities) {
        var configuration = new Configuration()
                .setPhysicalNamingStrategy(new CamelCaseToUnderscoresNamingStrategy());
        for (Class<?> entity : entities) configuration.addAnnotatedClass(entity);
        return configuration
                .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
                .setProperty("hibernate.connection.url", url)
                .setProperty("hibernate.connection.username", "sa")
                .setProperty("hibernate.connection.password", "")
                .setProperty("hibernate.hbm2ddl.auto", "validate")
                .setProperty("hibernate.show_sql", "false")
                .buildSessionFactory();
    }

    private static String createExistingSchema() throws Exception {
        String url = "jdbc:h2:mem:class_operation_mapping_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", "");
             var statement = connection.createStatement()) {
            // H2 2.2.224 resolves TEXT to CHARACTER VARYING(1_000_000_000), as in the restored DB.
            statement.execute("CREATE TABLE class_operations (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "
                    + "class_id BIGINT NOT NULL UNIQUE, actual_start_date VARCHAR(255), "
                    + "early_graduated_date VARCHAR(255), actual_end_date VARCHAR(255), topic_mark INTEGER, "
                    + "discipline_point INTEGER, bonus_point INTEGER, penalty_point INTEGER, "
                    + "has_no_allocation_needs BOOLEAN, milestones_json TEXT, total_weighted_number INTEGER)");
            statement.execute("CREATE TABLE class_topic_assessments (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "
                    + "class_id BIGINT NOT NULL, topic_index INTEGER, title VARCHAR(500), assessments_json TEXT)");
            statement.execute("CREATE TABLE training_calendars (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "
                    + "is_active BOOLEAN NOT NULL, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, "
                    + "created_by BIGINT, updated_by BIGINT, class_id BIGINT NOT NULL, revision INTEGER NOT NULL, "
                    + "name VARCHAR(100) NOT NULL, history_change VARCHAR(200) NOT NULL, modified_by VARCHAR(255) NOT NULL, "
                    + "schedule LONGTEXT NOT NULL, topics_json LONGTEXT NOT NULL, class_start_date DATE NOT NULL, "
                    + "actual_learning_start_date DATE NOT NULL, last_modified_date TIMESTAMP(6) NOT NULL, "
                    + "last_modified_by VARCHAR(255) NOT NULL)");
            try (var insert = connection.prepareStatement("INSERT INTO class_operations (class_id, milestones_json) VALUES (?, ?)")) {
                insert.setLong(1, 7L);
                insert.setString(2, LEGACY_JSON);
                insert.executeUpdate();
            }
        }
        return url;
    }

    @Entity(name = "LegacyClassOperationLobMapping")
    @Table(name = "class_operations")
    static class LegacyLobMapping {
        @Id
        private Long id;

        @Lob
        @Column(name = "milestones_json", columnDefinition = "TEXT")
        private String milestonesJson;
    }
}
