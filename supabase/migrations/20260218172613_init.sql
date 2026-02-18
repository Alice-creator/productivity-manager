-- Categories
create table categories (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);

-- Tasks
create table tasks (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  done boolean default false,
  created_at timestamptz default now()
);

-- Task ↔ Category (many-to-many)
create table task_categories (
  task_id bigint references tasks(id) on delete cascade,
  category_id bigint references categories(id) on delete cascade,
  primary key (task_id, category_id)
);

-- Time logs
create table time_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  task_id bigint references tasks(id) on delete cascade,
  duration_minutes int not null,
  logged_at timestamptz default now()
);

-- RLS policies (RLS already enabled at DB level)
create policy "own categories" on categories for all using (auth.uid() = user_id);
create policy "own tasks" on tasks for all using (auth.uid() = user_id);
create policy "own time_logs" on time_logs for all using (auth.uid() = user_id);
create policy "own task_categories" on task_categories for all using (
  exists (select 1 from tasks where tasks.id = task_id and tasks.user_id = auth.uid())
);
