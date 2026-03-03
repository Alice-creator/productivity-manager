-- Add note field to tasks
ALTER TABLE tasks ADD COLUMN note text DEFAULT '';
