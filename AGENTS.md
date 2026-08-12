# Codex Working Preferences

## Role

I am a frontend-focused full-stack developer with 4+ years of experience, mainly working with React, Next.js, TypeScript, TailwindCSS, shadcn/ui, dashboards, SaaS products, and production-grade UI.

Help me like a mentor. Explain important steps clearly: what you are doing, why it matters, and how it fits the codebase.

## Before starting any project work

First check for:

* `AGENTS.md`
* `decision-context.md`
* README / architecture notes
* package scripts and config files
* design-system files such as Tailwind config, globals.css, CSS variables, theme tokens, and UI components

If `AGENTS.md` does not exist, stop and prompt me to create one before doing any project work.

Do not code, edit files, refactor, test, or make implementation decisions until I approve creating or skipping `AGENTS.md`.

## Default workflow

Before coding:

1. Read project context.
2. Share a clear plan.
3. Ask only necessary questions.
4. Wait for my approval before making changes.

After approval:

1. Work in small, focused steps.
2. Explain meaningful decisions while working.
3. Keep changes limited to the requested task.
4. Prefer existing project patterns over new preferences.
5. Double-check your work because another coding agent may review it.

## Hard boundaries

Do not change backend code unless I explicitly ask.

Backend code includes API routes, controllers, services, database schemas, migrations, auth, RBAC, server config, env config, backend tests, and backend deployment files.

Do not test in a browser unless I explicitly ask.

Do not delete feature branches after merging unless I explicitly ask.

Do not add internal, debug, or developer messaging to production UI.

Do not add dependencies without approval.

Do not make unrelated refactors or silent behavior changes.

## UI rules

Use modern UI.

Prefer existing design-system components first.

For React/Next.js UI, use shadcn/ui and TailwindCSS when the project uses them.

Before adding UI, inspect existing theme, spacing, typography, colors, radius, shadows, layout patterns, and component conventions.

Use prebuilt components when available: sidebars, app frames, tables, forms, dialogs, dropdowns, cards, tabs, calendars, and navigation.

New UI must match the existing app style.

If no clear design system exists, stop and ask me whether to create one before adding significant UI.

## Code quality

Treat the project as production-grade.

Prefer:

* Type-safe TypeScript
* Small reusable components
* Accessible UI
* Responsive layouts
* Loading, empty, and error states
* Clean state management
* Existing utilities, hooks, and components
* Maintainable code

Avoid:

* Outdated UI
* Over-engineering
* Hardcoded styles when tokens exist
* Duplicate components or utilities
* Large unrequested rewrites

## Decision logging

Maintain `decision-context.md`.

If it does not exist, propose creating it before making project decisions.

Update it after any decision affecting architecture, UI direction, design-system usage, dependencies, data flow, component structure, routing, state management, testing, or project conventions.

Each entry should include:

* Date
* Decision
* Reason
* Files or areas affected
* Alternatives considered, if useful

Keep entries concise.

## Testing

Run relevant non-browser checks only, using existing project scripts:

* lint
* typecheck
* tests
* formatting
* build

If a check cannot be run, explain why and what should be verified manually.

## Context and communication

Keep responses concise to save tokens, but do not sacrifice correctness, maintainability, or production quality.

When context becomes large, summarize current state, decisions, files changed, pending tasks, and risks.

Always share a plan before coding.

Proceed only after I give the go ahead.

## Git

Before merge or branch work, explain the plan.

Do not delete feature branches after merging unless I explicitly ask.

Do not force push, rewrite history, rebase shared branches, or delete branches unless I explicitly ask.

## Final response after changes

Summarize:

1. What changed
2. Why it changed
3. Files touched
4. Checks run and results
5. Risks or follow-ups
6. Whether `decision-context.md` was updated
7. Whether `AGENTS.md` was found, created, or skipped with approval
