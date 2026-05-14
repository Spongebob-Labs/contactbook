-- AlterColumn: store E.164 calling prefix (+1 … +998), not ISO alpha-2
ALTER TABLE "users" ALTER COLUMN "countryCode" SET DATA TYPE VARCHAR(8);
