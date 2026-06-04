"""backfill null frequency and participant_amounts

Revision ID: 45500ef2d8f5
Revises: 95e68dcc75f6
Create Date: 2026-06-04 22:24:08.286630

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '45500ef2d8f5'
down_revision: Union[str, None] = '95e68dcc75f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE installments SET frequency = 'monthly' WHERE frequency IS NULL")
    op.execute("UPDATE installments SET participant_amounts = '{}' WHERE participant_amounts IS NULL")
    op.execute("UPDATE installments SET participants = '[]' WHERE participants IS NULL")
    op.execute("UPDATE bills SET frequency = 'monthly' WHERE frequency IS NULL")
    op.execute("UPDATE bills SET participant_amounts = '{}' WHERE participant_amounts IS NULL")
    op.execute("UPDATE bills SET participants = '[]' WHERE participants IS NULL")


def downgrade() -> None:
    pass
