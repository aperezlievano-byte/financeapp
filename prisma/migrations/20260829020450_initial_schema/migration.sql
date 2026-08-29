-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('savings', 'checking', 'cash', 'credit_card');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('manual', 'free_text', 'telegram', 'receipt', 'statement', 'excel_import');

-- CreateEnum
CREATE TYPE "PendingStatus" AS ENUM ('awaiting_review', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('receipt', 'statement', 'spreadsheet');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'extracted', 'failed');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID,
    "occurred_on" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "direction" "Direction" NOT NULL,
    "source" "Source" NOT NULL,
    "source_ref" TEXT,
    "document_id" UUID,
    "note" TEXT,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "PendingStatus" NOT NULL DEFAULT 'awaiting_review',
    "source" "Source" NOT NULL,
    "inbound_message_id" UUID,
    "document_id" UUID,
    "raw_input" TEXT NOT NULL,
    "extraction" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "occurred_on" DATE,
    "description" TEXT,
    "amount_cents" BIGINT,
    "direction" "Direction",
    "account_id" UUID,
    "category_id" UUID,
    "committed_transaction_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "pending_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_states" (
    "id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "awaiting" TEXT NOT NULL,
    "pending_transaction_id" UUID,
    "prompt_text" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversation_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_kind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_name_key" ON "accounts"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_key" ON "categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "transactions_user_id_occurred_on_idx" ON "transactions"("user_id", "occurred_on" DESC);

-- CreateIndex
CREATE INDEX "transactions_user_id_account_id_occurred_on_idx" ON "transactions"("user_id", "account_id", "occurred_on");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_source_source_ref_key" ON "transactions"("user_id", "source", "source_ref");

-- CreateIndex
CREATE UNIQUE INDEX "pending_transactions_inbound_message_id_key" ON "pending_transactions"("inbound_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_transactions_committed_transaction_id_key" ON "pending_transactions"("committed_transaction_id");

-- CreateIndex
CREATE INDEX "pending_transactions_user_id_status_created_at_idx" ON "pending_transactions"("user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "documents_user_id_sha256_key" ON "documents"("user_id", "sha256");

-- CreateIndex
CREATE INDEX "inbound_messages_channel_sender_created_at_idx" ON "inbound_messages"("channel", "sender", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_channel_provider_message_id_key" ON "inbound_messages"("channel", "provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_states_pending_transaction_id_key" ON "conversation_states"("pending_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_states_channel_sender_key" ON "conversation_states"("channel", "sender");

-- CreateIndex
CREATE INDEX "audit_log_resource_type_resource_id_created_at_idx" ON "audit_log"("resource_type", "resource_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_inbound_message_id_fkey" FOREIGN KEY ("inbound_message_id") REFERENCES "inbound_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_committed_transaction_id_fkey" FOREIGN KEY ("committed_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_pending_transaction_id_fkey" FOREIGN KEY ("pending_transaction_id") REFERENCES "pending_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
