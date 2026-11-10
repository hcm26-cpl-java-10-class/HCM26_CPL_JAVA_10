-- LOCAL TEST FIXTURE ONLY. Does not change the Project snapshot.
CREATE TABLE IF NOT EXISTS us02_source_topics (
    project_id BIGINT PRIMARY KEY, topic_code VARCHAR(100), version VARCHAR(50),
    description CLOB, objectives CLOB, requirements_json CLOB
);
INSERT INTO us02_source_topics (project_id, topic_code, version, description, objectives, requirements_json)
SELECT s.project_id, s.topic_code, s.version, s.description, s.objectives, s.requirements_json
FROM project_topic_snapshots s JOIN projects p ON p.id = s.project_id
WHERE p.code = 'WS-DEMO-EXISTING'
  AND p.tenant_id = (SELECT tenant_id FROM users WHERE email = 'student@example.com')
  AND NOT EXISTS (SELECT 1 FROM us02_source_topics old WHERE old.project_id = s.project_id);

UPDATE us02_source_topics SET version = 'v2.0.0',
    description = 'NEW source description v2', objectives = 'NEW source objectives v2',
    requirements_json = '["NEW source requirement v2"]'
WHERE project_id IN (SELECT id FROM projects WHERE code = 'WS-DEMO-EXISTING'
    AND tenant_id = (SELECT tenant_id FROM users WHERE email = 'student@example.com'));

SELECT src.topic_code, src.version AS source_version, s.version AS project_snapshot_version,
       src.description AS source_description, s.description AS project_snapshot_description
FROM us02_source_topics src JOIN project_topic_snapshots s ON s.project_id = src.project_id;
