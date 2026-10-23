ALTER TABLE "recommendation_models" ADD COLUMN "parameterSchema" JSONB NOT NULL DEFAULT '{"type":"object","additionalProperties":false,"properties":{}}';
ALTER TABLE "recommendation_indexes" ADD COLUMN "parameters" JSONB NOT NULL DEFAULT '{}';
