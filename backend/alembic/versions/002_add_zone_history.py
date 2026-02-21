"""Add zone history table

Revision ID: 002
Revises: 001
Create Date: 2024-12-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'zone_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('calculated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('activities_analyzed', sa.Integer(), nullable=True),
        sa.Column('date_range_start', sa.DateTime(), nullable=True),
        sa.Column('date_range_end', sa.DateTime(), nullable=True),
        sa.Column('max_hr', sa.Integer(), nullable=True),
        sa.Column('resting_hr', sa.Integer(), nullable=True),
        sa.Column('hr_zones', sa.JSON(), nullable=True),
        sa.Column('pace_zones', sa.JSON(), nullable=True),
        sa.Column('avg_hr_easy_runs', sa.Float(), nullable=True),
        sa.Column('avg_hr_tempo_runs', sa.Float(), nullable=True),
        sa.Column('avg_pace_easy_runs', sa.Float(), nullable=True),
        sa.Column('avg_pace_tempo_runs', sa.Float(), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_zone_history_id'), 'zone_history', ['id'], unique=False)
    op.create_index(op.f('ix_zone_history_user_id'), 'zone_history', ['user_id'], unique=False)
    op.create_index(op.f('ix_zone_history_calculated_at'), 'zone_history', ['calculated_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_zone_history_calculated_at'), table_name='zone_history')
    op.drop_index(op.f('ix_zone_history_user_id'), table_name='zone_history')
    op.drop_index(op.f('ix_zone_history_id'), table_name='zone_history')
    op.drop_table('zone_history')
