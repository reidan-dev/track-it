"""add recurring template fields + receipts to income

Revision ID: c4d8e6f2a9b1
Revises: b3f7a1c9d4e2
Create Date: 2026-09-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d8e6f2a9b1'
down_revision: Union[str, None] = 'b3f7a1c9d4e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('incomes', sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('incomes', sa.Column('start_month', sa.Integer(), nullable=True))
    op.add_column('incomes', sa.Column('start_year', sa.Integer(), nullable=True))
    op.add_column('incomes', sa.Column('end_month', sa.Integer(), nullable=True))
    op.add_column('incomes', sa.Column('end_year', sa.Integer(), nullable=True))

    op.create_table(
        'income_receipts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('income_id', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('period', sa.Integer(), nullable=False),
        sa.Column('amount_received', sa.Numeric(12, 2), nullable=True),
        sa.Column('date_received', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['income_id'], ['incomes.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_income_receipts_id'), 'income_receipts', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_income_receipts_id'), table_name='income_receipts')
    op.drop_table('income_receipts')
    op.drop_column('incomes', 'end_year')
    op.drop_column('incomes', 'end_month')
    op.drop_column('incomes', 'start_year')
    op.drop_column('incomes', 'start_month')
    op.drop_column('incomes', 'is_recurring')
