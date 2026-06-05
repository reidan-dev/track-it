"""balance reminder scheduled per period (P1/P2)

Revision ID: e5f2b9c1a3d8
Revises: d4e8a1b6c2f7
Create Date: 2026-06-05 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f2b9c1a3d8'
down_revision: Union[str, None] = 'd4e8a1b6c2f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ADD = [
    ('balance_p1_day', sa.Integer()),
    ('balance_p1_time', sa.String()),
    ('balance_p1_lead_prev_month', sa.Boolean()),
    ('balance_p1_last_sent', sa.String()),
    ('balance_p2_day', sa.Integer()),
    ('balance_p2_time', sa.String()),
    ('balance_p2_lead_prev_month', sa.Boolean()),
    ('balance_p2_last_sent', sa.String()),
]
DROP = [
    ('balance_reminder_day', sa.Integer()),
    ('balance_reminder_time', sa.String()),
    ('balance_last_sent', sa.String()),
]


def upgrade() -> None:
    for name, type_ in ADD:
        op.add_column('user_settings', sa.Column(name, type_, nullable=True))
    for name, _ in DROP:
        op.drop_column('user_settings', name)


def downgrade() -> None:
    for name, type_ in DROP:
        op.add_column('user_settings', sa.Column(name, type_, nullable=True))
    for name, _ in reversed(ADD):
        op.drop_column('user_settings', name)
