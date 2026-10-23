BEGIN;

-- Per-dish locks serialize projection revision and capture, including related-entity changes.
CREATE OR REPLACE FUNCTION recommendation_capture_dish(target_id TEXT) RETURNS VOID AS $$
DECLARE snapshot JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('recommendation-dish:' || target_id, 0));
  SELECT to_jsonb(d) || jsonb_build_object(
    'canteenName', c.name, 'windowName', COALESCE(w.name, d."windowName"),
    'windowNumber', COALESCE(w.number, d."windowNumber")
  ) INTO snapshot
  FROM dishes d LEFT JOIN canteens c ON c.id = d."canteenId"
    LEFT JOIN windows w ON w.id = d."windowId"
  WHERE d.id = target_id;
  INSERT INTO recommendation_projections AS current ("dishId", revision, payload, deleted, "updatedAt")
    VALUES (target_id, 1, snapshot, snapshot IS NULL, now())
  ON CONFLICT ("dishId") DO UPDATE SET revision = current.revision + 1,
    payload = EXCLUDED.payload, deleted = EXCLUDED.deleted, "updatedAt" = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recommendation_dishes_changed() RETURNS TRIGGER AS $$
DECLARE target_id TEXT;
BEGIN
  FOR target_id IN SELECT id FROM changed_dishes ORDER BY id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recommendation_dishes_insert AFTER INSERT ON dishes
  REFERENCING NEW TABLE AS changed_dishes FOR EACH STATEMENT EXECUTE FUNCTION recommendation_dishes_changed();
CREATE TRIGGER recommendation_dishes_update AFTER UPDATE ON dishes
  REFERENCING NEW TABLE AS changed_dishes FOR EACH STATEMENT EXECUTE FUNCTION recommendation_dishes_changed();
CREATE TRIGGER recommendation_dishes_delete AFTER DELETE ON dishes
  REFERENCING OLD TABLE AS changed_dishes FOR EACH STATEMENT EXECUTE FUNCTION recommendation_dishes_changed();

CREATE OR REPLACE FUNCTION recommendation_canteens_changed() RETURNS TRIGGER AS $$
DECLARE target_id TEXT;
BEGIN
  FOR target_id IN SELECT d.id FROM dishes d JOIN changed_canteens c ON c.id = d."canteenId" ORDER BY d.id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER recommendation_canteens_update AFTER UPDATE ON canteens
  REFERENCING NEW TABLE AS changed_canteens FOR EACH STATEMENT EXECUTE FUNCTION recommendation_canteens_changed();

CREATE OR REPLACE FUNCTION recommendation_windows_changed() RETURNS TRIGGER AS $$
DECLARE target_id TEXT;
BEGIN
  FOR target_id IN SELECT d.id FROM dishes d JOIN changed_windows w ON w.id = d."windowId" ORDER BY d.id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER recommendation_windows_update AFTER UPDATE ON windows
  REFERENCING NEW TABLE AS changed_windows FOR EACH STATEMENT EXECUTE FUNCTION recommendation_windows_changed();

-- The migration transaction captures existing dishes before application writes resume.
DO $$
DECLARE target_id TEXT;
BEGIN
  FOR target_id IN SELECT id FROM dishes ORDER BY id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
END;
$$;

COMMIT;
