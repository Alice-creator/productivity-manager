-- Replace boolean `done` with text `status` column (todo | in_progress | done)
ALTER TABLE tasks ADD COLUMN status text NOT NULL DEFAULT 'todo';
UPDATE tasks SET status = 'done' WHERE done = true;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'done'));
ALTER TABLE tasks DROP COLUMN done;
