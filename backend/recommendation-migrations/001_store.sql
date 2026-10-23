CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS recommendation_store;
CREATE TABLE IF NOT EXISTS recommendation_store.indexes (
  id TEXT PRIMARY KEY,
  dimension INTEGER NOT NULL CHECK (dimension BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
