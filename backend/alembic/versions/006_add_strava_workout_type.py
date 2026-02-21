"""Add Strava workout_type and is_commute columns

Revision ID: 006
Revises: 005
Create Date: 2024-12-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add Strava workout classification fields
    # workout_type: For runs: 0=default, 1=race, 2=long run, 3=workout
    # For rides: 10=default, 11=race, 12=workout
    op.add_column('activities', sa.Column('workout_type', sa.Integer(), nullable=True))
    op.add_column('activities', sa.Column('is_commute', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('activities', 'is_commute')
    op.drop_column('activities', 'workout_type')
