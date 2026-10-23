BEGIN;

-- Keep trigger replacement and repair within one catalog-write boundary.
LOCK TABLE canteens, windows, dishes IN SHARE ROW EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION recommendation_lock_parents(parent_keys TEXT[]) RETURNS VOID AS $$
DECLARE parent_key TEXT;
BEGIN
  FOR parent_key IN SELECT DISTINCT key FROM unnest(parent_keys) AS keys(key)
    WHERE key IS NOT NULL ORDER BY key
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('recommendation-parent:' || parent_key, 0));
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recommendation_dishes_changed() RETURNS TRIGGER AS $$
DECLARE target_id TEXT;
DECLARE parent_keys TEXT[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(parent_key) INTO parent_keys FROM (
      SELECT 'canteen:' || "canteenId" AS parent_key FROM changed_dishes
      UNION SELECT 'window:' || "windowId" FROM changed_dishes
      UNION SELECT 'canteen:' || "canteenId" FROM previous_dishes
      UNION SELECT 'window:' || "windowId" FROM previous_dishes
    ) AS parents;
    PERFORM recommendation_lock_parents(parent_keys);
  ELSIF TG_OP = 'INSERT' THEN
    SELECT array_agg(parent_key) INTO parent_keys FROM (
      SELECT 'canteen:' || "canteenId" AS parent_key FROM changed_dishes
      UNION SELECT 'window:' || "windowId" FROM changed_dishes
    ) AS parents;
    PERFORM recommendation_lock_parents(parent_keys);
  END IF;

  -- Deletes retain dish tombstones. Foreign-key locks serialize parent deletion
  -- with inserts/moves, and cascade deletion captures each removed dish.
  FOR target_id IN SELECT id FROM changed_dishes ORDER BY id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER recommendation_dishes_update ON dishes;
CREATE TRIGGER recommendation_dishes_update AFTER UPDATE ON dishes
  REFERENCING OLD TABLE AS previous_dishes NEW TABLE AS changed_dishes
  FOR EACH STATEMENT EXECUTE FUNCTION recommendation_dishes_changed();

CREATE OR REPLACE FUNCTION recommendation_canteens_changed() RETURNS TRIGGER AS $$
DECLARE target_id TEXT;
BEGIN
  PERFORM recommendation_lock_parents(ARRAY(SELECT 'canteen:' || id FROM changed_canteens));
  -- This query runs after acquiring membership locks, using a fresh snapshot.
  FOR target_id IN SELECT d.id FROM dishes d JOIN changed_canteens c ON c.id = d."canteenId" ORDER BY d.id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recommendation_windows_changed() RETURNS TRIGGER AS $$
DECLARE target_id TEXT;
BEGIN
  PERFORM recommendation_lock_parents(ARRAY(SELECT 'window:' || id FROM changed_windows));
  FOR target_id IN SELECT d.id FROM dishes d JOIN changed_windows w ON w.id = d."windowId" ORDER BY d.id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Refresh live projections so pre-migration membership races are repaired.
DO $$
DECLARE target_id TEXT;
BEGIN
  FOR target_id IN SELECT id FROM dishes ORDER BY id LOOP
    PERFORM recommendation_capture_dish(target_id);
  END LOOP;
END;
$$;

COMMIT;
