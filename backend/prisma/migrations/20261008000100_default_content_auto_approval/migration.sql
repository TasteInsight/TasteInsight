UPDATE "admin_config_templates"
SET "defaultValue" = 'true', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN ('review.autoApprove', 'comment.autoApprove')
  AND "defaultValue" = 'false';
