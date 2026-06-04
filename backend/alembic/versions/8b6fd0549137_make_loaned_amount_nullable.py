"""make loaned_amount nullable

Revision ID: 8b6fd0549137
Revises: db02677ee5c8
Create Date: 2026-06-04 22:49:14.171237

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8b6fd0549137'
down_revision: Union[str, None] = 'db02677ee5c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import sqlalchemy as sa
    op.alter_column("installments", "loaned_amount", existing_type=sa.Numeric(12, 2), nullable=True)


def downgrade() -> None:
    import sqlalchemy as sa
    op.alter_column("installments", "loaned_amount", existing_type=sa.Numeric(12, 2), nullable=False)
