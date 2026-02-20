-- Trigger: notify application_logs INSERTs to application_changes for real-time frontend streaming.
-- Fires for all application_logs (production + live-dev). Live dev also uses live_dev_logs for CLI.
-- Backend broadcasts by application_id and application_deployment_id so deployment viewers receive it.
CREATE OR REPLACE FUNCTION notify_application_changes_log() RETURNS trigger AS $$
DECLARE
  payload TEXT;
BEGIN
  IF NEW.application_deployment_id IS NULL THEN
    RETURN NEW;
  END IF;

  payload := json_build_object(
    'table', 'application_logs',
    'action', 'INSERT',
    'application_id', NEW.application_id,
    'data', json_build_object(
      'id', NEW.id,
      'application_id', NEW.application_id,
      'application_deployment_id', NEW.application_deployment_id,
      'log', NEW.log,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    )
  )::text;

  PERFORM pg_notify('application_changes', payload);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_application_changes_log_notify ON application_logs;
CREATE TRIGGER trg_application_changes_log_notify
  AFTER INSERT ON application_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_application_changes_log();
