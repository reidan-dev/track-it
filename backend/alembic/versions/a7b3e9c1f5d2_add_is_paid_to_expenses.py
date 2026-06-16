"""add is_paid to expenses

Revision ID: a7b3e9c1f5d2
Revises: d7f4a1c9e2b8
Create Date: 2026-06-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b3e9c1f5d2'
down_revision: Union[str, None] = 'd7f4a1c9e2b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('is_paid', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('expenses', 'is_paid')
