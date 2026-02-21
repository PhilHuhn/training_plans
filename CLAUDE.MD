# Turbine Turmweg Training

## Project Overview
A private training plan management app for runners (5K to ultramarathons) with Strava integration and AI-powered training recommendations.

## Tech Stack

### Backend (Full-Stack)
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy with Alembic migrations
- **Authentication**: JWT-based with python-jose (cookie + Bearer token)
- **Templates**: Jinja2 with HTMX for dynamic interactions
- **Styling**: Tailwind CSS (via CDN)
- **External APIs**:
  - Strava API (OAuth2 for activity sync)
  - Anthropic Claude API (training recommendations)

### Deployment
- **Application**: Single FastAPI server serving both API and HTML
- **Database**: PostgreSQL (Vercel Postgres / Neon / local)
- **Docker**: docker-compose for local development

## Project Structure
```
turbine-turmweg/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py
│   │   │   │   ├── activities.py
│   │   │   │   ├── competitions.py
│   │   │   │   ├── training.py
│   │   │   │   └── strava.py
│   │   │   └── deps.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── database.py
│   │   │   └── claude_client.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── activity.py
│   │   │   ├── competition.py
│   │   │   └── training_session.py
│   │   ├── schemas/
│   │   │   └── *.py
│   │   ├── services/
│   │   │   ├── strava_service.py
│   │   │   ├── training_engine.py
│   │   │   └── document_parser.py
│   │   └── prompts/
│   │       └── training_recommendation.py
│   ├── templates/
│   │   ├── base.html
│   │   ├── auth/
│   │   │   ├── login.html
│   │   │   └── register.html
│   │   ├── dashboard/
│   │   │   ├── base.html
│   │   │   ├── training.html
│   │   │   ├── activities.html
│   │   │   ├── competitions.html
│   │   │   └── settings.html
│   │   └── partials/
│   │       └── competitions_list.html
│   ├── alembic/
│   ├── requirements.txt
│   ├── main.py
│   ├── Dockerfile
│   └── start.sh
├── docker-compose.yml
├── CLAUDE.MD
└── README.md
```

## Database Schema

### Users
- id, email, password_hash, name
- strava_access_token, strava_refresh_token, strava_athlete_id
- preferences (JSON: units, hr_zones, pace_zones)
- created_at, updated_at

### Activities (synced from Strava)
- id, user_id, strava_id
- type, name, distance, duration
- avg_heart_rate, max_heart_rate
- avg_pace, elevation_gain
- start_date, raw_data (JSON)

### Competitions
- id, user_id, name, race_type (5K/10K/HM/M/Ultra)
- race_date, distance, goal_time
- priority (A/B/C race)
- location, notes

### TrainingSessions
- id, user_id, session_date
- source (app_recommendation / uploaded_plan / manual)
- planned_workout (JSON: type, distance, duration, intensity, hr_zones, pace)
- recommendation_workout (JSON: same structure)
- completed_activity_id (FK to Activities, nullable)
- status (planned/completed/skipped/modified)
- notes

### UploadedPlans
- id, user_id, filename, content_text
- parsed_sessions (JSON array)
- upload_date, is_active

## Core Features

### 1. Activity History
- Sync activities from Strava (runs only)
- Display with key metrics: distance, pace, HR, elevation
- Filtering by date range, type

### 2. Competition Management
- Add upcoming races with goals
- Priority classification (A/B/C races)
- Goal time and distance
- Days until countdown

### 3. Training Plan View (Two-Column)
Left column: Fixed plans (from uploaded documents or manual entry)
Right column: AI recommendations based on:
- Recent activity load
- Upcoming competitions
- Heart rate and pace trends
- Recovery status

### 4. Document Upload
- Support PDF, Word (.docx), plain text
- Parse training sessions using Claude
- Map to internal session format

### 5. Pace ↔ HR Conversion
- Convert pace-based plans to HR-based and vice versa
- Use personal HR zones and pace zones
- Claude-powered intelligent conversion

## Routes

### HTML Pages (served by FastAPI)
- GET / - Redirect to dashboard or login
- GET /login - Login page
- POST /login - Login form submission
- GET /register - Registration page
- POST /register - Registration form submission
- GET /logout - Clear session and redirect
- GET /dashboard - Training view (main page)
- GET /training - Alias for dashboard
- GET /activities - Activities list
- GET /competitions - Competitions management
- GET /settings - User settings

### API Endpoints (JSON + HTMX)
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login and get token
- GET /api/auth/me - Get current user

- GET /api/strava/auth - Strava OAuth redirect
- GET /api/strava/callback - OAuth callback
- POST /api/strava/sync - Sync activities

- GET /api/activities - List activities
- GET /api/activities/{id} - Get single activity
- GET /api/activities/stats/summary - Activity statistics

- GET /api/competitions - List competitions
- POST /api/competitions - Create competition (JSON or form)
- GET /api/competitions/{id} - Get competition
- PUT /api/competitions/{id} - Update competition
- DELETE /api/competitions/{id} - Delete competition

- GET /api/training/sessions - List training sessions
- GET /api/training/sessions/week - Get week's sessions
- POST /api/training/sessions - Create session
- PUT /api/training/sessions/{id} - Update session
- DELETE /api/training/sessions/{id} - Delete session
- POST /api/training/generate-recommendations - AI recommendations
- POST /api/training/upload-plan - Upload training document
- POST /api/training/convert-session - Pace/HR conversion

## Environment Variables

```
DATABASE_URL=postgresql+asyncpg://turbine:turbine_dev@localhost:5432/turbine_turmweg
SECRET_KEY=your-secret-key-here
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Development Commands

### Using Docker (recommended)
```bash
# Start all services
docker-compose up

# Access app at http://localhost:8000
```

### Local Development (without Docker)
```bash
# Start PostgreSQL (requires local installation)
# Create database: turbine_turmweg

cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

## Key Implementation Notes

1. **Authentication**: Cookie-based for HTML pages, Bearer token for API calls
2. **HTMX Integration**: API routes detect HTMX requests and return HTML partials
3. **Strava OAuth**: Use authorization code flow, store tokens securely, implement refresh logic
4. **Claude Integration**: Use structured output (JSON mode) for reliable parsing
5. **Training Load**: Calculate using TRIMP or similar metrics from HR data
6. **Recommendations**: Should respect rest days, taper periods, progressive overload
7. **Document Parsing**: Use Claude to extract structured training data from uploaded docs

## Design Guidelines

- Clean, minimalist interface
- Mobile-responsive (Tailwind CSS)
- Color scheme: Primary green/teal (`primary-600`), grays for text
- Typography: Clean sans-serif (system fonts via Tailwind)
- HTMX for smooth interactions without full page reloads
