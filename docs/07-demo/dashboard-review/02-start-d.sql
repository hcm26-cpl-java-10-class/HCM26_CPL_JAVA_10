-- Optional: run only when ready to demonstrate completion of the D team.
SET TIME ZONE 'Asia/Ho_Chi_Minh';
SELECT c.code, t.team_name, p.id AS project_id, p.status
FROM project_teams t JOIN training_classes c ON c.class_id=t.class_id
JOIN projects p ON p.id=t.project_id
WHERE c.tenant_id=1 AND c.code='DASH-D' AND t.team_name='DASH-D-FINISH';

SET AUTOCOMMIT FALSE;
UPDATE projects p SET status='ACTIVE', updated_at=CURRENT_TIMESTAMP
WHERE p.tenant_id=1 AND p.status='PLANNING' AND EXISTS (
  SELECT 1 FROM project_teams t JOIN training_classes c ON c.class_id=t.class_id
  WHERE t.project_id=p.id AND c.tenant_id=1 AND c.code='DASH-D'
    AND t.team_name='DASH-D-FINISH');
UPDATE milestones m SET auto_start_enabled=TRUE, start_date=CURRENT_DATE,
  scheduled_start_at=DATEADD('MINUTE',-1,CURRENT_TIMESTAMP),
  version=version+1, updated_at=CURRENT_TIMESTAMP
WHERE m.tenant_id=1 AND m.is_active=TRUE AND m.status='PLANNED'
  AND m.lifecycle_status='PLANNED' AND EXISTS (
    SELECT 1 FROM project_teams t JOIN training_classes c ON c.class_id=t.class_id
    WHERE t.id=m.team_id AND t.project_id=m.project_id AND c.tenant_id=1
      AND c.code='DASH-D' AND t.team_name='DASH-D-FINISH');
COMMIT;
SET AUTOCOMMIT TRUE;
