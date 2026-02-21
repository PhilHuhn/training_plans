# Turbine Turmweg Training

AI-powered training plan management for runners - from 5K to ultramarathons.

## Features

- **Activity Sync**: Connect to Strava to automatically sync your running activities
- **Competition Management**: Track upcoming races with goals and priority levels
- **Two-Column Training View**: See your fixed training plan alongside AI recommendations
- **AI Recommendations**: Get personalized training suggestions based on your recent activities, upcoming races, and fitness level
- **Document Upload**: Upload training plans from your coach (PDF, Word, TXT) and have them parsed automatically
- **Pace/HR Conversion**: Convert between pace-based and heart rate-based training plans
- **Multi-user Support**: Create accounts for you and your friends

## Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: Next.js 14 with TypeScript
- **Database**: PostgreSQL
- **AI**: Anthropic Claude API
- **Styling**: Tailwind CSS with shadcn/ui

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (or use Docker)
- Strava API credentials
- Anthropic API key

### Local Development

1. **Clone and setup environment**

```bash
# Clone the repository
git clone <your-repo-url>
cd turbine-turmweg

# Create environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

2. **Configure environment variables**

Edit `backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/turbine_turmweg
SECRET_KEY=your-secret-key
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
ANTHROPIC_API_KEY=your-anthropic-api-key
FRONTEND_URL=http://localhost:3000
```

Edit `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

3. **Start with Docker (recommended)**

```bash
docker-compose up -d
```

Or start services manually:

4. **Backend setup**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

5. **Frontend setup**

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000 to access the application.

## Strava API Setup

1. Go to https://www.strava.com/settings/api
2. Create a new application
3. Set the Authorization Callback Domain to `localhost` (or your production domain)
4. Copy the Client ID and Client Secret to your `.env` file

## Deployment

### Frontend (Vercel)

1. Connect your repository to Vercel
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL`: Your backend URL

### Backend

The backend can be deployed to:
- **Railway** (free tier available)
- **Render** (free tier available)
- **Fly.io** (free tier available)

Configure these environment variables in your deployment platform:
- `DATABASE_URL`
- `SECRET_KEY`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI` (update to production URL)
- `ANTHROPIC_API_KEY`
- `FRONTEND_URL`

### Database

Options for PostgreSQL:
- **Vercel Postgres** (free tier)
- **Neon** (free tier)
- **Supabase** (free tier)
- **Railway** (free tier)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Strava
- `GET /api/strava/auth-url` - Get Strava OAuth URL
- `POST /api/strava/callback` - Handle OAuth callback
- `POST /api/strava/sync` - Sync activities

### Activities
- `GET /api/activities` - List activities
- `GET /api/activities/stats/summary` - Get statistics

### Competitions
- `GET /api/competitions` - List competitions
- `POST /api/competitions` - Create competition
- `PUT /api/competitions/{id}` - Update competition
- `DELETE /api/competitions/{id}` - Delete competition

### Training
- `GET /api/training/sessions` - Get training sessions
- `GET /api/training/sessions/week` - Get week view
- `POST /api/training/sessions` - Create session
- `PUT /api/training/sessions/{id}` - Update session
- `POST /api/training/generate-recommendations` - Generate AI recommendations
- `POST /api/training/convert-session` - Convert pace/HR
- `POST /api/training/upload-plan` - Upload training plan

## Project Structure

```
turbine-turmweg/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # API endpoints
│   │   ├── core/            # Config, security, database
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   └── prompts/         # Claude prompts
│   ├── alembic/             # Database migrations
│   └── main.py              # FastAPI app
├── frontend/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   └── lib/                 # Utilities and API client
├── docker-compose.yml
└── README.md
```

## Contributing

This is a private project for friends. If you have access, feel free to submit PRs!

## License

Private - All rights reserved.
