"""add period bill reminder settings

Revision ID: b7e1c0a4d9f2
Revises: 924c39885705
Create Date: 2026-06-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e1c0a4d9f2'
down_revision: Union[str, None] = '924c39885705'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COLUMNS = [
    ('bill_reminder_enabled', sa.Boolean()),
    ('p1_reminder_day', sa.Integer()),
    ('p1_reminder_time', sa.String()),
    ('p2_reminder_day', sa.Integer()),
    ('p2_reminder_time', sa.String()),
    ('reminder_utc_offset', sa.Integer()),
    ('p1_last_sent', sa.String()),
    ('p2_last_sent', sa.String()),
]


def upgrade() -> None:
    for name, type_ in COLUMNS:
        op.add_column('user_settings', sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column('user_settings', name)
