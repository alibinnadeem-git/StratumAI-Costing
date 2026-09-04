-- Commercial integrity guardrails for controlled estimates.
-- Applied to production Neon on 2026-09-03 and retained here for reproducible schema history.

CREATE OR REPLACE FUNCTION protect_controlled_estimate_children()
RETURNS trigger AS $$
DECLARE
  parent_status "EstimateStatus";
  parent_id text;
BEGIN
  parent_id := COALESCE(NEW."estimateId", OLD."estimateId");
  SELECT status INTO parent_status FROM "CostEstimate" WHERE id = parent_id;

  IF parent_status IN ('SUBMITTED','AWARDED','LOST','ARCHIVED') THEN
    RAISE EXCEPTION 'Estimate % is controlled (%). Create a revision before changing commercial detail.', parent_id, parent_status
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_estimate_lines ON "EstimateLineItem";
CREATE TRIGGER trg_protect_estimate_lines
BEFORE INSERT OR UPDATE OR DELETE ON "EstimateLineItem"
FOR EACH ROW EXECUTE FUNCTION protect_controlled_estimate_children();

DROP TRIGGER IF EXISTS trg_protect_estimate_adders ON "EstimateAdder";
CREATE TRIGGER trg_protect_estimate_adders
BEFORE INSERT OR UPDATE OR DELETE ON "EstimateAdder"
FOR EACH ROW EXECUTE FUNCTION protect_controlled_estimate_children();

CREATE OR REPLACE FUNCTION protect_controlled_estimate_header()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('SUBMITTED','AWARDED','LOST','ARCHIVED') THEN
      RAISE EXCEPTION 'Controlled estimate % (%) cannot be deleted. Archive or create a revision instead.', OLD.id, OLD.status
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('SUBMITTED','AWARDED','LOST','ARCHIVED') THEN
    IF NEW.name IS DISTINCT FROM OLD.name
      OR NEW.condition IS DISTINCT FROM OLD.condition
      OR NEW."laborRate" IS DISTINCT FROM OLD."laborRate"
      OR NEW."overheadPercent" IS DISTINCT FROM OLD."overheadPercent"
      OR NEW."profitMarginPercent" IS DISTINCT FROM OLD."profitMarginPercent"
      OR NEW."difficultyMultiplier" IS DISTINCT FROM OLD."difficultyMultiplier"
      OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
      OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Estimate % is controlled (%). Create a revision before changing commercial settings.', OLD.id, OLD.status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_estimate_header_update ON "CostEstimate";
CREATE TRIGGER trg_protect_estimate_header_update
BEFORE UPDATE OR DELETE ON "CostEstimate"
FOR EACH ROW EXECUTE FUNCTION protect_controlled_estimate_header();
