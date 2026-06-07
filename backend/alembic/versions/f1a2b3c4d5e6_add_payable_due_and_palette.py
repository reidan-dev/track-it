"""add paid_by/payable_to/due_date to expenses, payable_from/due_date to incomes, palette to users

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-06-07 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('paid_by', sa.Integer(), nullable=True))
    op.add_column('expenses', sa.Column('payable_to', sa.Integer(), nullable=True))
    op.add_column('expenses', sa.Column('due_date', sa.Date(), nullable=True))
    op.add_column('incomes', sa.Column('payable_from', sa.Integer(), nullable=True))
    op.add_column('incomes', sa.Column('due_date', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('palette', sa.String(), nullable=True, server_default='blue'))


def downgrade() -> None:
    op.drop_column('users', 'palette')
    op.drop_column('incomes', 'due_date')
    op.drop_column('incomes', 'payable_from')
    op.drop_column('expenses', 'due_date')
    op.drop_column('expenses', 'payable_to')
    op.drop_column('expenses', 'paid_by')
