"""add balance summary reminder settings

Revision ID: d4e8a1b6c2f7
Revises: c3d9f1a2b4e6
Create Date: 2026-06-05 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e8a1b6c2f7'
down_revision: Union[str, None] = 'c3d9f1a2b4e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COLUMNS = [
    ('balance_reminder_enabled', sa.Boolean()),
    ('balance_reminder_day', sa.Integer()),
    ('balance_reminder_time', sa.String()),
    ('balance_last_sent', sa.String()),
]


def upgrade() -> None:
    for name, type_ in COLUMNS:
        op.add_column('user_settings', sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column('user_settings', name)
