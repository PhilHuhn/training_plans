"""Add final_workout and accepted_source columns to training_sessions

Revision ID: 003
Revises: 002_add_zone_history
Create Date: 2024-12-14

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add accepted_source enum column
    op.add_column('training_sessions', sa.Column(
        'accepted_source',
        sa.String(20),
        nullable=True,
        server_default='none'
    ))

    # Add final_workout JSON column
    op.add_column('training_sessions', sa.Column(
        'final_workout',
        sa.JSON(),
        nullable=True
    ))


def downgrade() -> None:
    op.drop_column('training_sessions', 'final_workout')
    op.drop_column('training_sessions', 'accepted_source')
