"""Add rpe_actual column to training_sessions

Revision ID: 008
Revises: 007
Create Date: 2026-02-22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('training_sessions', sa.Column(
        'rpe_actual',
        sa.Integer(),
        nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('training_sessions', 'rpe_actual')
