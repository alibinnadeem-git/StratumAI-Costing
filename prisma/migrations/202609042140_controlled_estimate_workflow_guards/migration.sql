CREATE OR REPLACE FUNCTION protect_controlled_estimate_children()
RETURNS trigger AS $$
DECLARE
  parent_status "EstimateStatus";
  parent_id text;
BEGIN
  parent_id := COALESCE(NEW."estimateId", OLD."estimateId");
  SELECT status INTO parent_status FROM "CostEstimate" WHERE id = parent_id;

  IF parent_status IN ('APPROVED','SUBMITTED','AWARDED','LOST','SUPERSEDED','ARCHIVED') THEN
    RAISE EXCEPTION 'Estimate % is controlled (%). Create a revision before changing commercial detail.', parent_id, parent_status
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_controlled_estimate_header()
RETURNS trigger AS $$
DECLARE
  transition_ok boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('APPROVED','SUBMITTED','AWARDED','LOST','SUPERSEDED','ARCHIVED') THEN
      RAISE EXCEPTION 'Controlled estimate % (%) cannot be deleted. Archive or create a revision instead.', OLD.id, OLD.status
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  transition_ok := CASE OLD.status
    WHEN 'DRAFT' THEN NEW.status IN ('DRAFT','REVIEW','ARCHIVED')
    WHEN 'REVIEW' THEN NEW.status IN ('DRAFT','REVIEW','APPROVED','ARCHIVED')
    WHEN 'APPROVED' THEN NEW.status IN ('APPROVED','SUBMITTED','SUPERSEDED','ARCHIVED')
    WHEN 'SUBMITTED' THEN NEW.status IN ('SUBMITTED','AWARDED','LOST','SUPERSEDED','ARCHIVED')
    WHEN 'AWARDED' THEN NEW.status IN ('AWARDED','ARCHIVED')
    WHEN 'LOST' THEN NEW.status IN ('LOST','ARCHIVED')
    WHEN 'SUPERSEDED' THEN NEW.status IN ('SUPERSEDED','ARCHIVED')
    WHEN 'ARCHIVED' THEN NEW.status = 'ARCHIVED'
    ELSE false
  END;

  IF NOT transition_ok THEN
    RAISE EXCEPTION 'Illegal estimate status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status IN ('APPROVED','SUBMITTED','AWARDED','LOST','SUPERSEDED','ARCHIVED') THEN
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
