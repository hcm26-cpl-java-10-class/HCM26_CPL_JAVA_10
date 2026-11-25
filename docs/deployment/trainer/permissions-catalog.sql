-- Register the four Trainer permissions only. Do not grant/revoke any role membership.
INSERT INTO permissions(name, resource, action, description, is_active, created_at, updated_at)
SELECT 'TRAINER_READ', 'TRAINER', 'READ', 'Read internal trainer directory', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'TRAINER_READ');
INSERT INTO permissions(name, resource, action, description, is_active, created_at, updated_at)
SELECT 'TRAINER_CREATE', 'TRAINER', 'CREATE', 'Create and import internal trainers', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'TRAINER_CREATE');
INSERT INTO permissions(name, resource, action, description, is_active, created_at, updated_at)
SELECT 'TRAINER_UPDATE', 'TRAINER', 'UPDATE', 'Update internal trainers and status', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'TRAINER_UPDATE');
INSERT INTO permissions(name, resource, action, description, is_active, created_at, updated_at)
SELECT 'TRAINER_DELETE', 'TRAINER', 'DELETE', 'Archive unreferenced internal trainers', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'TRAINER_DELETE');
