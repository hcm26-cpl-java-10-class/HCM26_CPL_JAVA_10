-- Team Charter checkpoint 2; MySQL 8 deployment DDL (apply ONCE before deploying).
-- Local/test Hibernate schema update/create can generate the same additions.
-- No existing charter values, team membership or database configuration are changed.
-- Back up the deployment database and review SHOW CREATE TABLE project_teams first.
-- Existing content remains at business revision 0; this never creates consent.
ALTER TABLE project_teams
    ADD COLUMN charter_revision BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN charter_roster_token VARCHAR(64) NULL;

CREATE TABLE team_charter_revisions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    team_id BIGINT NOT NULL,
    revision_number BIGINT NOT NULL,
    content_json LONGTEXT NOT NULL,
    actor_id BIGINT NOT NULL,
    saved_at TIMESTAMP(6) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_charter_team_revision UNIQUE (team_id, revision_number),
    CONSTRAINT fk_charter_revision_team FOREIGN KEY (team_id) REFERENCES project_teams(id)
);
-- Intentionally no ON DELETE CASCADE: removing a team must not erase revision evidence.
-- Use the existing connection time-zone policy (UTC) for TIMESTAMP evidence.

CREATE TABLE team_charter_responsibilities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    team_id BIGINT NOT NULL,
    membership_id BIGINT NOT NULL,
    responsibility VARCHAR(1000) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_charter_responsibility UNIQUE (team_id, membership_id),
    CONSTRAINT fk_charter_responsibility_team FOREIGN KEY (team_id) REFERENCES project_teams(id)
);

CREATE TABLE team_charter_confirmations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    team_id BIGINT NOT NULL,
    revision_number BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    roster_token VARCHAR(64) NOT NULL,
    member_snapshot TEXT NOT NULL,
    confirmed_at TIMESTAMP(6) NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_charter_consent UNIQUE (team_id, revision_number, user_id),
    CONSTRAINT fk_charter_consent_revision FOREIGN KEY (team_id, revision_number)
        REFERENCES team_charter_revisions(team_id, revision_number)
);
-- User/member IDs intentionally have no cascading FK; consent stores an immutable member snapshot.
