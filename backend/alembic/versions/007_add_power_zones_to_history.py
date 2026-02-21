"""Add threshold_pace, ftp, cycling_power_zones to zone_history

Revision ID: 007
Revises: 006
Create Date: 2026-02-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('zone_history', sa.Column('threshold_pace', sa.Float(), nullable=True))
    op.add_column('zone_history', sa.Column('ftp', sa.Integer(), nullable=True))
    op.add_column('zone_history', sa.Column('cycling_power_zones', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('zone_history', 'cycling_power_zones')
    op.drop_column('zone_history', 'ftp')
    op.drop_column('zone_history', 'threshold_pace')
