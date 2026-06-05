"""add name to expenses

Revision ID: b9d5f3a1c6e4
Revises: a8c4e2f1d9b3
Create Date: 2026-06-05 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b9d5f3a1c6e4'
down_revision: Union[str, None] = 'a8c4e2f1d9b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('name', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('expenses', 'name')
