"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('strava_access_token', sa.String(length=255), nullable=True),
        sa.Column('strava_refresh_token', sa.String(length=255), nullable=True),
        sa.Column('strava_athlete_id', sa.Integer(), nullable=True),
        sa.Column('strava_token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('preferences', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_strava_athlete_id'), 'users', ['strava_athlete_id'], unique=True)

    # Activities table
    op.create_table(
        'activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('strava_id', sa.String(length=50), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.Column('distance', sa.Float(), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('elevation_gain', sa.Float(), nullable=True),
        sa.Column('calories', sa.Integer(), nullable=True),
        sa.Column('avg_heart_rate', sa.Float(), nullable=True),
        sa.Column('max_heart_rate', sa.Float(), nullable=True),
        sa.Column('avg_pace', sa.Float(), nullable=True),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('start_date_local', sa.DateTime(), nullable=True),
        sa.Column('raw_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_activities_id'), 'activities', ['id'], unique=False)
    op.create_index(op.f('ix_activities_start_date'), 'activities', ['start_date'], unique=False)
    op.create_index(op.f('ix_activities_strava_id'), 'activities', ['strava_id'], unique=True)

    # Competitions table
    op.create_table(
        'competitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('race_type', sa.Enum('FIVE_K', 'TEN_K', 'HALF_MARATHON', 'MARATHON', 'ULTRA_50K', 'ULTRA_100K', 'ULTRA_50M', 'ULTRA_100M', 'OTHER', name='racetype'), nullable=False),
        sa.Column('distance', sa.Float(), nullable=True),
        sa.Column('elevation_gain', sa.Float(), nullable=True),
        sa.Column('race_date', sa.Date(), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('goal_time', sa.Integer(), nullable=True),
        sa.Column('goal_pace', sa.Float(), nullable=True),
        sa.Column('priority', sa.Enum('A', 'B', 'C', name='racepriority'), nullable=True),
        sa.Column('notes', sa.String(length=2000), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competitions_id'), 'competitions', ['id'], unique=False)
    op.create_index(op.f('ix_competitions_race_date'), 'competitions', ['race_date'], unique=False)

    # Uploaded plans table
    op.create_table(
        'uploaded_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=True),
        sa.Column('content_text', sa.String(), nullable=True),
        sa.Column('parsed_sessions', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Integer(), nullable=True),
        sa.Column('upload_date', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_uploaded_plans_id'), 'uploaded_plans', ['id'], unique=False)

    # Training sessions table
    op.create_table(
        'training_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('source', sa.Enum('APP_RECOMMENDATION', 'UPLOADED_PLAN', 'MANUAL', name='sessionsource'), nullable=True),
        sa.Column('status', sa.Enum('PLANNED', 'COMPLETED', 'SKIPPED', 'MODIFIED', name='sessionstatus'), nullable=True),
        sa.Column('planned_workout', sa.JSON(), nullable=True),
        sa.Column('recommendation_workout', sa.JSON(), nullable=True),
        sa.Column('completed_activity_id', sa.Integer(), nullable=True),
        sa.Column('uploaded_plan_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.String(length=2000), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['completed_activity_id'], ['activities.id'], ),
        sa.ForeignKeyConstraint(['uploaded_plan_id'], ['uploaded_plans.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_training_sessions_id'), 'training_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_training_sessions_session_date'), 'training_sessions', ['session_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_training_sessions_session_date'), table_name='training_sessions')
    op.drop_index(op.f('ix_training_sessions_id'), table_name='training_sessions')
    op.drop_table('training_sessions')
    op.drop_index(op.f('ix_uploaded_plans_id'), table_name='uploaded_plans')
    op.drop_table('uploaded_plans')
    op.drop_index(op.f('ix_competitions_race_date'), table_name='competitions')
    op.drop_index(op.f('ix_competitions_id'), table_name='competitions')
    op.drop_table('competitions')
    op.drop_index(op.f('ix_activities_strava_id'), table_name='activities')
    op.drop_index(op.f('ix_activities_start_date'), table_name='activities')
    op.drop_index(op.f('ix_activities_id'), table_name='activities')
    op.drop_table('activities')
    op.drop_index(op.f('ix_users_strava_athlete_id'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
