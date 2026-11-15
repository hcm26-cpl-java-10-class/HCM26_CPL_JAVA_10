-- Optional for MySQL deployments using ddl-auto=validate/none.
-- Default development ddl-auto=update creates these tables automatically.
-- Additive only: does not update courses, enrollments, grades, uploads or user data.
CREATE TABLE IF NOT EXISTS course_recommendation_preferences (
    user_id BIGINT NOT NULL PRIMARY KEY,
    version BIGINT,
    goals VARCHAR(1000) NOT NULL
);
CREATE TABLE IF NOT EXISTS course_recommendation_interests (
    user_id BIGINT NOT NULL,
    topic VARCHAR(80),
    CONSTRAINT fk_recommendation_interest_preferences FOREIGN KEY (user_id)
        REFERENCES course_recommendation_preferences(user_id)
);
CREATE TABLE IF NOT EXISTS course_recommendation_dismissals (
    user_id BIGINT NOT NULL,
    course_id BIGINT,
    CONSTRAINT fk_recommendation_dismissal_preferences FOREIGN KEY (user_id)
        REFERENCES course_recommendation_preferences(user_id)
);
