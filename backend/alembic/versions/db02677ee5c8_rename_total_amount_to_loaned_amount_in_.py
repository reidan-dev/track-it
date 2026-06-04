"""rename total_amount to loaned_amount in installments

Revision ID: db02677ee5c8
Revises: 8386fa89266d
Create Date: 2026-06-04 22:37:56.917552

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'db02677ee5c8'
down_revision: Union[str, None] = '8386fa89266d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("installments", "total_amount", new_column_name="loaned_amount", existing_nullable=True)


def downgrade() -> None:
    op.alter_column("installments", "loaned_amount", new_column_name="total_amount", existing_nullable=True)
