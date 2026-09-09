-- Run after deploying the application without product-image support.
-- Removes all product photo data; other product fields are unchanged.
BEGIN;
UPDATE public."Product" SET "imageUrl" = NULL WHERE "imageUrl" IS NOT NULL;
ALTER TABLE public."Product" DROP COLUMN "imageUrl";
COMMIT;
