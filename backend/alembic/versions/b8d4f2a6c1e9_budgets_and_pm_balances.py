"""Add category budgets to user_settings and anchor balances to payment_methods

Revision ID: b8d4f2a6c1e9
Revises: a7b3e9c1f5d2
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8d4f2a6c1e9'
down_revision: Union[str, None] = 'a7b3e9c1f5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_settings', sa.Column('category_budgets', sa.JSON(), nullable=True))
    op.add_column('payment_methods', sa.Column('balance', sa.Numeric(12, 2), nullable=True))
    op.add_column('payment_methods', sa.Column('balance_updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('payment_methods', 'balance_updated_at')
    op.drop_column('payment_methods', 'balance')
    op.drop_column('user_settings', 'category_budgets')
