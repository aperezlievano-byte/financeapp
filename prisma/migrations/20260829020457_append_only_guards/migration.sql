ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount_cents > 0);
ALTER TABLE pending_transactions ADD CONSTRAINT pending_amount_positive CHECK (amount_cents IS NULL OR amount_cents > 0);

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % sobre % esta prohibido', TG_OP, TG_TABLE_NAME;
END $$;

CREATE OR REPLACE FUNCTION transactions_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id           IS DISTINCT FROM OLD.id
  OR NEW.user_id      IS DISTINCT FROM OLD.user_id
  OR NEW.account_id   IS DISTINCT FROM OLD.account_id
  OR NEW.occurred_on  IS DISTINCT FROM OLD.occurred_on
  OR NEW.description  IS DISTINCT FROM OLD.description
  OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
  OR NEW.direction    IS DISTINCT FROM OLD.direction
  OR NEW.source       IS DISTINCT FROM OLD.source
  OR NEW.source_ref   IS DISTINCT FROM OLD.source_ref
  OR NEW.created_at   IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'transactions es append-only: solo deleted_at, category_id y note pueden cambiar';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_log_immutable      BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER transactions_no_delete   BEFORE DELETE ON transactions
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER transactions_append_only BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_guard();
