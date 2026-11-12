"""add allowed_holders to shared_tracker_rows

Revision ID: b4e7f2c8a1d3
Revises: c3f8a6d1e9b4
Create Date: 2026-11-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4e7f2c8a1d3'
down_revision: Union[str, None] = 'c3f8a6d1e9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shared_tracker_rows', sa.Column('allowed_holders', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('shared_tracker_rows', 'allowed_holders')
