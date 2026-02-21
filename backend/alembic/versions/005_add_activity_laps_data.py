"""Add laps_data column to activities table

Revision ID: 005
Revises: 004
Create Date: 2024-12-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add laps_data JSON column for detailed lap/segment data
    op.add_column('activities', sa.Column(
        'laps_data',
        sa.JSON(),
        nullable=True
    ))


def downgrade() -> None:
    op.drop_column('activities', 'laps_data')
