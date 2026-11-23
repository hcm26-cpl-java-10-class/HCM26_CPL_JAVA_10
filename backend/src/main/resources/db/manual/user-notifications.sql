-- Required before starting the safe-deployment profile (ddl-auto=validate).
-- Default development ddl-auto=update creates the same table automatically.
CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    user_id BIGINT NOT NULL,
    event_key VARCHAR(180) NOT NULL,
    title VARCHAR(120) NOT NULL,
    message VARCHAR(500) NOT NULL,
    target_url VARCHAR(500) NULL,
    read_at DATETIME(6) NULL,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uk_notification_user_event UNIQUE (user_id, event_key),
    INDEX idx_notification_user_created (user_id, created_at)
);

-- Upgrade Hibernate-created tables that used a global unique event_key.
-- The index name is generated, so discover it instead of assuming a name.
SET @old_event_index = (
    SELECT index_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'user_notifications'
      AND column_name = 'event_key'
      AND non_unique = 0
      AND index_name <> 'uk_notification_user_event'
    LIMIT 1
);
SET @drop_old_event_index = IF(
    @old_event_index IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE user_notifications DROP INDEX `', @old_event_index, '`')
);
PREPARE notification_migration FROM @drop_old_event_index;
EXECUTE notification_migration;
DEALLOCATE PREPARE notification_migration;

SET @has_recipient_event_index = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'user_notifications'
      AND index_name = 'uk_notification_user_event'
);
SET @add_recipient_event_index = IF(
    @has_recipient_event_index > 0,
    'SELECT 1',
    'ALTER TABLE user_notifications ADD CONSTRAINT uk_notification_user_event UNIQUE (user_id, event_key)'
);
PREPARE notification_migration FROM @add_recipient_event_index;
EXECUTE notification_migration;
DEALLOCATE PREPARE notification_migration;
