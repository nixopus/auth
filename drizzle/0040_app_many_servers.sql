CREATE TABLE "application_servers" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  "server_id"      uuid NOT NULL REFERENCES ssh_keys(id) ON DELETE RESTRICT,
  "is_primary"     boolean NOT NULL DEFAULT false,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  UNIQUE("application_id", "server_id")
);

CREATE UNIQUE INDEX "application_servers_one_primary_per_app"
  ON application_servers(application_id) WHERE is_primary = true;

CREATE INDEX "idx_application_servers_application_id" ON application_servers(application_id);
CREATE INDEX "idx_application_servers_server_id" ON application_servers(server_id);

ALTER TABLE applications
  ADD COLUMN routing_strategy varchar(20) NOT NULL DEFAULT 'single';

ALTER TABLE application_deployment
  ADD COLUMN server_id uuid REFERENCES ssh_keys(id),
  ADD COLUMN parent_deployment_id uuid REFERENCES application_deployment(id) ON DELETE SET NULL;

INSERT INTO application_servers (id, application_id, server_id, is_primary, created_at)
SELECT gen_random_uuid(), a.id, sk.id, true, NOW()
FROM applications a
JOIN LATERAL (
  SELECT id FROM ssh_keys
  WHERE organization_id = a.organization_id
    AND deleted_at IS NULL AND is_active = true
  ORDER BY is_default DESC, created_at DESC LIMIT 1
) sk ON true
ON CONFLICT (application_id, server_id) DO NOTHING;
