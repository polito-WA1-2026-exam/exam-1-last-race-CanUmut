# Exam #1: "Last Race"
## Student: 354820 CAN UMUT

## React Client Application Routes

- Route `/`: public landing page with the game instructions. Anonymous visitors can only access this page and the login page.
- Route `/login`: authentication form for registered users.
- Route `/game`: authenticated game flow, including network study, timed route planning, execution events, and the final result.
- Route `/ranking`: authenticated general ranking based on each user's best score.

## API Server

- GET `/api/health`
  - Public diagnostic endpoint that checks whether the Express server and SQLite database are available.
  - Returns the server state, database state, and check timestamp.
- POST `/api/login`
  - Body: `{ "username": string, "password": string }`.
  - Authenticates with Passport Local Strategy and creates a session cookie.
- POST `/api/logout`
  - Ends the current authenticated session.
- GET `/api/check-login`
  - Returns the authenticated user's id and username, or HTTP 401.
- GET `/api/map`
  - Authenticated endpoint returning station data and ordered station ids for each line.
- GET `/api/game/init`
  - Authenticated endpoint that randomly selects a reachable start/destination pair at least three segments apart.
  - Returns the assigned station ids and the shuffled list of available network segments.
- POST `/api/game/validate`
  - Body: `{ "route": [{ "s1": number, "s2": number }] }`.
  - Validates continuity, real network connections, line changes, repeated segments, and the session-stored start/destination.
  - For valid routes, applies one random event per segment, stores the score, and returns the execution steps and final score.
- GET `/api/ranking`
  - Authenticated endpoint returning every user's best score in descending order.

## Database Tables

- Table `users` - registered users with salted bcrypt password hashes.
- Table `stations` - the fixed underground station names.
- Table `lines` - the four underground line definitions.
- Table `line_stations` - ordered station membership for each line.
- Table `connections` - valid adjacent station pairs and their line.
- Table `events` - random journey event descriptions and coin effects.
- Table `games` - completed games, scores, users, and timestamps.
- Table `app_meta` - internal seed/network version metadata.

## Main React Components

- `AppShell` (in `App.jsx`): application layout, navigation, authentication state, and protected routes.
- `Home` (in `App.jsx`): public game presentation and instructions.
- `Login` (in `App.jsx`): login form and authentication feedback.
- `GamePage` (in `App.jsx`): controls the complete multi-phase game state.
- `MetroMap` (in `App.jsx`): SVG underground network visualization.
- `MissionBrief` (in `App.jsx`): setup phase with the complete network and rules.
- `Planning` (in `App.jsx`): 90-second route-building phase with hidden connections.
- `Execution` (in `App.jsx`): animated journey events and final score.
- `Ranking` (in `App.jsx`): best-score leaderboard.
- `SystemStatus` (in `App.jsx`): live API and SQLite health indicator.

## Screenshots

Two screenshots must be added before the final submission:

- `img/ranking.png` - general ranking page.
- `img/game.png` - application during a game.

## Users Credentials

- `user1`, `password1`
- `user2`, `password2`
- `user3`, `password3`

## Use of AI Tools

AI coding assistance (OpenAI Codex) was used to clarify the assignment, debug client/server integration, review the game rules, and assist with implementation and visual styling. The generated suggestions were adapted to the project structure and verified through production builds, API requests, SQLite queries, and manual browser testing.
