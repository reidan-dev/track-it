"""balance reminder shares the bill P1/P2 schedule

Revision ID: f6a3d2e8b9c1
Revises: e5f2b9c1a3d8
Create Date: 2026-06-05 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a3d2e8b9c1'
down_revision: Union[str, None] = 'e5f2b9c1a3d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DROP = [
    ('balance_p1_day', sa.Integer()),
    ('balance_p1_time', sa.String()),
    ('balance_p1_lead_prev_month', sa.Boolean()),
    ('balance_p2_day', sa.Integer()),
    ('balance_p2_time', sa.String()),
    ('balance_p2_lead_prev_month', sa.Boolean()),
]


def upgrade() -> None:
    for name, _ in DROP:
        op.drop_column('user_settings', name)


def downgrade() -> None:
    for name, type_ in DROP:
        op.add_column('user_settings', sa.Column(name, type_, nullable=True))
