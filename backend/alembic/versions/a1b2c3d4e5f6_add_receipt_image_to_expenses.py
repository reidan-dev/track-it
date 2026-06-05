"""add receipt_image to expenses

Revision ID: a1b2c3d4e5f6
Revises: b9d5f3a1c6e4
Create Date: 2026-06-05 13:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'b9d5f3a1c6e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('receipt_image', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('expenses', 'receipt_image')
