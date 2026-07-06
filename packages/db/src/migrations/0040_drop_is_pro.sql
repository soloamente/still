-- Legacy Pro flag migrated to plan_override in 0039; entitlements now derive from tier + grants.
ALTER TABLE "profile" DROP COLUMN IF EXISTS "is_pro";
