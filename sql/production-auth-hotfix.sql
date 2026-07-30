DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'ADMIN';

UPDATE "User"
SET "username" = LOWER(
  COALESCE(
    NULLIF(SPLIT_PART(COALESCE("email", ''), '@', 1), ''),
    'user-' || SUBSTRING("id" FROM 1 FOR 8)
  )
)
WHERE "username" IS NULL;

UPDATE "User"
SET "passwordHash" = 'ccd7a3f6bb8068812a1ad7fcc9b1793d:19973d5ef1819df087106ae7ec66f67aacc5f2818877577c7a1603c542bad9c5c41234f5f543851d0fc7ce57065cf2613d34cc438c6017c8a2730b77ae4f2307'
WHERE "passwordHash" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "username" SET NOT NULL,
  ALTER COLUMN "passwordHash" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email") WHERE "email" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");

CREATE TABLE IF NOT EXISTS "UserSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX IF NOT EXISTS "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

INSERT INTO "User" ("id", "username", "passwordHash", "email", "name", "role", "createdAt", "updatedAt")
VALUES (
  'admin_seed_user',
  'admin',
  'ccd7a3f6bb8068812a1ad7fcc9b1793d:19973d5ef1819df087106ae7ec66f67aacc5f2818877577c7a1603c542bad9c5c41234f5f543851d0fc7ce57065cf2613d34cc438c6017c8a2730b77ae4f2307',
  'admin@wiings.local',
  'Administrator',
  'ADMIN',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO UPDATE
SET "passwordHash" = EXCLUDED."passwordHash",
    "email" = EXCLUDED."email",
    "name" = EXCLUDED."name",
    "role" = EXCLUDED."role",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Location" ("id", "code", "name", "createdAt", "updatedAt")
VALUES
  ('seed_kho_tong', 'KHO_TONG', 'Kho Tổng', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_kho_le', 'KHO_LE', 'Kho Lẻ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "updatedAt" = CURRENT_TIMESTAMP;