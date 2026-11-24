-- Apply before deploying when Hibernate DDL updates are disabled.
create table if not exists learning_roadmaps (
    user_id bigint primary key references users(id) on delete cascade,
    revision bigint not null,
    career_goal varchar(150) not null,
    current_level varchar(20) not null,
    hours_per_week integer not null,
    duration_months integer not null,
    plan_json text,
    generated_at timestamp with time zone
);
alter table learning_roadmaps add column if not exists duration_weeks integer;
alter table learning_roadmaps add column if not exists plan_outdated boolean;
