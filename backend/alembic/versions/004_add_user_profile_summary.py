"""Add profile_summary column to users table

Revision ID: 004
Revises: 003
Create Date: 2024-12-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add profile_summary text column for AI-generated user profile
    op.add_column('users', sa.Column(
        'profile_summary',
        sa.Text(),
        nullable=True
    ))


def downgrade() -> None:
    op.drop_column('users', 'profile_summary')
