-- Status transition logs (checkpoints)
create table status_logs (
  id bigint generated always as identity primary key,
  task_id bigint references tasks(id) on delete cascade,
  status text not null check (status in ('todo', 'in_progress', 'done')),
  changed_at timestamptz default now()
);

create policy "own status_logs" on status_logs for all using (
  exists (select 1 from tasks where tasks.id = task_id and tasks.user_id = auth.uid())
);
