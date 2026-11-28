-- Optional for MySQL deployments using ddl-auto=validate/none.
-- Default development ddl-auto=update creates this table automatically.
-- Additive only: does not modify existing courses, enrollments, or user data.
CREATE TABLE IF NOT EXISTS course_bookmarks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    user_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    CONSTRAINT uk_course_bookmark_user_course UNIQUE (user_id, course_id)
);
