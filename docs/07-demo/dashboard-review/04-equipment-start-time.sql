-- Local time fixture for template 145, after the reviewed 144 -> 145 local switch.
-- Step 1: choose exactly one team and the desired start instant.
SET TIME ZONE 'Asia/Ho_Chi_Minh';
SET @equipment_class = 'DASH-C';
SET @equipment_team = 'Choji';
SET @equipment_template = 'DASH-EQUIP-CD1';
-- DASH-C currently has Choji and Ino. Change this value to the exact team
-- name you create/use; the class + template checks below still restrict scope.
SET @equipment_start = CURRENT_TIMESTAMP;
-- To rehearse a future start, replace the last line with, for example:
-- SET @equipment_start = DATEADD('MINUTE', 10, CURRENT_TIMESTAMP);
-- Or use an explicit local date/time with UTC offset, chosen for your demo date:
-- SET @equipment_start = TIMESTAMP WITH TIME ZONE '2026-11-05 15:30:00+07:00';

-- Step 2: preview. Expect one Project and three PLANNED milestones for that team.
SELECT c.code, t.team_name, p.id AS project_id, p.status, m.milestone_id,
  m.title, m.lifecycle_status, @equipment_start AS requested_start
FROM project_teams t JOIN training_classes c ON c.class_id=t.class_id
JOIN project_templates pt ON pt.id=t.project_template_id
JOIN projects p ON p.id=t.project_id
JOIN milestones m ON m.project_id=p.id AND m.team_id=t.id
WHERE c.tenant_id=1 AND p.tenant_id=1 AND m.tenant_id=1 AND pt.tenant_id=1
  AND c.code=@equipment_class AND c.code IN ('DASH-C','DASH-D') AND pt.code=@equipment_template
  AND t.team_name=@equipment_team AND m.is_active=TRUE
ORDER BY m.deadline, m.title;

-- Step 3: schedule only untouched PLANNED milestones. No outcome is forced.
SET AUTOCOMMIT FALSE;
UPDATE projects p SET status='ACTIVE', updated_at=CURRENT_TIMESTAMP
WHERE p.tenant_id=1 AND p.status='PLANNING' AND EXISTS (
  SELECT 1 FROM project_teams t JOIN training_classes c ON c.class_id=t.class_id
  JOIN project_templates pt ON pt.id=t.project_template_id
  WHERE t.project_id=p.id AND c.tenant_id=1 AND pt.tenant_id=1
    AND c.code=@equipment_class AND c.code IN ('DASH-C','DASH-D') AND t.team_name=@equipment_team AND pt.code=@equipment_template);
UPDATE milestones m SET auto_start_enabled=TRUE,
  start_date=CAST(@equipment_start AS DATE), scheduled_start_at=@equipment_start,
  deadline=DATEADD('DAY', CASE m.title WHEN 'M1 - Analysis' THEN 1 WHEN 'M2 - Implementation' THEN 3 WHEN 'M3 - Handover' THEN 7 END, @equipment_start),
  late_until=DATEADD('DAY', CASE m.title WHEN 'M1 - Analysis' THEN 3 WHEN 'M2 - Implementation' THEN 5 WHEN 'M3 - Handover' THEN 9 END, @equipment_start),
  version=version+1, updated_at=CURRENT_TIMESTAMP
WHERE m.tenant_id=1 AND m.is_active=TRUE AND m.status='PLANNED' AND m.lifecycle_status='PLANNED'
  AND m.title IN ('M1 - Analysis','M2 - Implementation','M3 - Handover')
  AND EXISTS (SELECT 1 FROM project_teams t JOIN training_classes c ON c.class_id=t.class_id
    JOIN project_templates pt ON pt.id=t.project_template_id
    WHERE t.id=m.team_id AND t.project_id=m.project_id AND c.tenant_id=1 AND pt.tenant_id=1
      AND c.code=@equipment_class AND c.code IN ('DASH-C','DASH-D') AND t.team_name=@equipment_team AND pt.code=@equipment_template);
COMMIT;
SET AUTOCOMMIT TRUE;

-- Wait for the real application scheduler (default interval: 60 seconds).
-- With a future start, wait until the chosen instant plus one scheduler cycle.
-- Repeat for Ino when ready. Leave the DASH-D team untouched for NOT_STARTED.
