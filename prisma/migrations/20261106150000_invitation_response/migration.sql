CREATE TYPE "InvitationResponse" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "Invitation"
ADD COLUMN "response" "InvitationResponse" NOT NULL DEFAULT 'PENDING';