-- Trigger function for application_logs: fires pg_notify on INSERT for live dev logs.
-- Identifies live-dev deployments by commit_hash prefix (not log prefix) because
-- Docker build logs go through the regular TaskContext which doesn't add [LiveDev].
CREATE OR REPLACE FUNCTION notify_live_dev_log() RETURNS trigger AS $$
DECLARE
  payload TEXT;
  dep_hash TEXT;
BEGIN
  -- Filter: only fire for live-dev deployments (identified by commit_hash)
  IF NEW.application_deployment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT commit_hash INTO dep_hash
  FROM application_deployment
  WHERE id = NEW.application_deployment_id;

  IF dep_hash IS NULL OR dep_hash NOT LIKE 'live-dev-%' THEN
    RETURN NEW;
  END IF;

  payload := json_build_object(
    'application_id', NEW.application_id,
    'deployment_id', NEW.application_deployment_id,
    'log', NEW.log,
    'created_at', NEW.created_at
  )::text;

  PERFORM pg_notify('live_dev_logs', payload);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_live_dev_log_notify
  AFTER INSERT ON application_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_live_dev_log();

-- Trigger function for application_deployment_status: fires pg_notify on INSERT/UPDATE
CREATE OR REPLACE FUNCTION notify_live_dev_status() RETURNS trigger AS $$
DECLARE
  payload TEXT;
  dep_hash TEXT;
  app_id UUID;
BEGIN
  -- Look up the deployment to check if it's live-dev and get the application_id
  SELECT ad.commit_hash, ad.application_id
  INTO dep_hash, app_id
  FROM application_deployment ad
  WHERE ad.id = NEW.application_deployment_id;

  IF dep_hash IS NULL OR dep_hash NOT LIKE 'live-dev-%' THEN
    RETURN NEW;
  END IF;

  payload := json_build_object(
    'application_id', app_id,
    'deployment_id', NEW.application_deployment_id,
    'status', NEW.status,
    'updated_at', NEW.updated_at
  )::text;

  PERFORM pg_notify('live_dev_status', payload);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_live_dev_status_notify
  AFTER INSERT OR UPDATE ON application_deployment_status
  FOR EACH ROW
  EXECUTE FUNCTION notify_live_dev_status();
