"""add lead-previous-month flags to bill reminders

Revision ID: c3d9f1a2b4e6
Revises: b7e1c0a4d9f2
Create Date: 2026-06-05 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d9f1a2b4e6'
down_revision: Union[str, None] = 'b7e1c0a4d9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_settings', sa.Column('p1_lead_prev_month', sa.Boolean(), nullable=True))
    op.add_column('user_settings', sa.Column('p2_lead_prev_month', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_settings', 'p2_lead_prev_month')
    op.drop_column('user_settings', 'p1_lead_prev_month')
