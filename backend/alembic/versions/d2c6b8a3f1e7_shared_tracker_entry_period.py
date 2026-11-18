"""shared tracker entry period (1st-15 / 16th-End)

Revision ID: d2c6b8a3f1e7
Revises: f7a2c9e4b1d8
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2c6b8a3f1e7'
down_revision: Union[str, None] = 'f7a2c9e4b1d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shared_tracker_entries', sa.Column('period', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('shared_tracker_entries', 'period')
