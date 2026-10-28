-- Additive upgrade; run with schema-owner role, not the restricted bridge role.
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS "agentId" TEXT;
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS "sessionKey" TEXT;
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS "authorizedAt" TIMESTAMP(3);
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS "decidedBy" TEXT;
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS "bootId" TEXT;
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS "inputMode" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "AgentRequest" ADD COLUMN IF NOT EXISTS transcript TEXT;
CREATE INDEX IF NOT EXISTS "AgentRequest_agentId_sessionKey_createdAt_idx" ON "AgentRequest" ("agentId","sessionKey","createdAt");
-- Replace mission_hq_bridge with the deployed restricted role name; no credential changes.
-- GRANT SELECT, UPDATE ON "AgentRequest" TO mission_hq_bridge;
-- GRANT SELECT, INSERT, UPDATE ON "BridgeControl" TO mission_hq_bridge;
-- GRANT SELECT, INSERT, UPDATE ON "DataStore" TO mission_hq_bridge;
