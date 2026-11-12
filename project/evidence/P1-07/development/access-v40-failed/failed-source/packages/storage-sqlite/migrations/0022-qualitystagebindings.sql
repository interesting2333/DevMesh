CREATE TABLE quality_stage_bindings (
 operation_id TEXT NOT NULL REFERENCES quality_verifications(operation_id),
 producer_id TEXT NOT NULL,
 pipeline_id TEXT NOT NULL,
 ordinal INTEGER NOT NULL,
 stage_operation_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 PRIMARY KEY(operation_id,producer_id),
 UNIQUE(pipeline_id,ordinal),
 FOREIGN KEY(pipeline_id,ordinal) REFERENCES pipeline_stages(pipeline_id,ordinal)
) STRICT;
CREATE TRIGGER quality_stage_binding_immutable BEFORE UPDATE ON quality_stage_bindings BEGIN SELECT RAISE(ABORT,'QUALITY_STAGE_BINDING_IMMUTABLE'); END;
CREATE TRIGGER quality_stage_binding_retained BEFORE DELETE ON quality_stage_bindings BEGIN SELECT RAISE(ABORT,'QUALITY_STAGE_BINDING_RETAINED'); END;
