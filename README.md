# Productivity Manager

A focused, no-fluff productivity app built for people who want to plan their week, track their time, and actually see if they're improving — without spending an hour learning the tool.

## Why this exists

Most productivity apps are too general. They try to do everything, so you spend more time configuring them than being productive. This app does one thing: helps you plan your week, track what actually happened, and shows you the data clearly.

## Features

- **Weekly Planner** — Plan tasks across a 7-column week grid. Drag into time slots, color-code by category.
- **Dashboard** — The home screen. All your key graphs at a glance, not buried in menus.
- **Analytics**
  - Completion rate (planned vs done per day)
  - Time distribution by category (where your time actually goes)
  - Streak calendar (days you hit your goals)
  - Weekly trend (are you improving over 8 weeks?)
  - Energy map (which hours you're most productive)
- **Google Sign-in** — One click to get in, no separate account to manage.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Backend / Database | Supabase (PostgreSQL + Auth + API) |
| Charts | Recharts |
| Deploy | Vercel |

See [docs/service-decision.md](docs/service-decision.md) for why these were chosen.

## Getting started

### 1. Clone the repo

```bash
git clone <repo-url>
cd productivity-manager/app
npm install
```

### 2. Set up environment variables

Create a `.env` file inside `app/`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
```

Get these from your Supabase project → **Settings → API**.

### 3. Apply the database migration

See [docs/applying-migrations.md](docs/applying-migrations.md) for instructions.

### 4. Run locally

```bash
npm run dev
```

## Roadmap

- [x] Project setup & planning
- [x] Supabase schema (tasks, time logs, categories)
- [x] Google authentication
- [x] Weekly planner view (7-day grid, 15-min slots, toggle done)
- [x] Dashboard with charts (completion rate, trend, time distribution, streak, energy map)
- [x] Deploy to Vercel
