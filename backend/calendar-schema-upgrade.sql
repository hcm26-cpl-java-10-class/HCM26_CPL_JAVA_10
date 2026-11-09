-- Upgrade the established MySQL calendar table without deleting any rows.
-- Run once; check SHOW COLUMNS before repeating.
ALTER TABLE training_calendars
    ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE training_calendars
SET created_at = last_modified_date, updated_at = last_modified_date;
