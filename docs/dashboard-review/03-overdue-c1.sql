-- Optional time fixture, before C-RISK's first submission. Changes no review result.
-- Keeps a late window open so the deadline scheduler does not close the milestone.
SET TIME ZONE 'Asia/Ho_Chi_Minh';
SELECT m.milestone_id, m.title, m.deadline, m.lifecycle_status
FROM milestones m JOIN project_teams t ON t.id=m.team_id
JOIN training_classes c ON c.class_id=t.class_id
WHERE m.tenant_id=1 AND c.tenant_id=1 AND c.code='DASH-C'
  AND t.team_name='DASH-C-RISK' AND m.project_id=t.project_id AND m.is_active=TRUE
ORDER BY m.deadline;

SET AUTOCOMMIT FALSE;
UPDATE milestones m SET deadline=DATEADD('MINUTE',-5,CURRENT_TIMESTAMP),
  late_policy_type='ALLOW_LATE', late_until=DATEADD('DAY',2,CURRENT_TIMESTAMP),
  late_penalty_percent=5, late_penalty_basis='PER_DAY',
  version=version+1, updated_at=CURRENT_TIMESTAMP
WHERE m.tenant_id=1 AND m.is_active=TRUE AND m.lifecycle_status='IN_PROGRESS'
  AND m.deadline=(SELECT MIN(m2.deadline) FROM milestones m2
    WHERE m2.team_id=m.team_id AND m2.project_id=m.project_id AND m2.tenant_id=1 AND m2.is_active=TRUE)
  AND EXISTS (SELECT 1 FROM project_teams t JOIN training_classes c ON c.class_id=t.class_id
    WHERE t.id=m.team_id AND t.project_id=m.project_id AND c.tenant_id=1
      AND c.code='DASH-C' AND t.team_name='DASH-C-RISK');
COMMIT;
SET AUTOCOMMIT TRUE;
