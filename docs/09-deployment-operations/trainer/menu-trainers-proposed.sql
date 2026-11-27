-- PROPOSAL ONLY. Do not execute until the targeted menu change is approved.
-- H2 2.2.224; no group creation, menu synchronization, grants, or unrelated updates.
-- Review the SELECT results first. The existing Training Management group must
-- resolve to exactly one active row, and any existing /trainers row must match
-- the approved metadata. A conflicting row requires manual review, not overwrite.
SELECT id, name, is_active FROM module_groups WHERE name = 'Training Management';
SELECT id, module_group_id, title, url, icon, display_order, required_permission, is_active
FROM modules WHERE url = '/trainers';

-- Idempotent targeted registration. The existing five Training Management rows
-- and every other group/module are left untouched.
INSERT INTO modules(module_group_id, title, url, icon, display_order,
                    required_permission, description, is_active, created_at, updated_at)
SELECT g.id, 'Trainers', '/trainers', 'users', 7,
       'TRAINER_READ', 'Approved internal Trainer Management', TRUE,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM module_groups g
WHERE g.name = 'Training Management' AND g.is_active = TRUE
  AND (SELECT COUNT(*) FROM module_groups WHERE name = 'Training Management') = 1
  AND NOT EXISTS (SELECT 1 FROM modules WHERE url = '/trainers');

SELECT m.id, g.name AS group_name, m.title, m.url, m.icon, m.display_order,
       m.required_permission, m.is_active
FROM modules m JOIN module_groups g ON g.id = m.module_group_id
WHERE m.url = '/trainers';
