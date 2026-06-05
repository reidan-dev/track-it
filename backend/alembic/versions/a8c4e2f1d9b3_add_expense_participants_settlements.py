"""add participants/splits + settlements to expenses

Revision ID: a8c4e2f1d9b3
Revises: f6a3d2e8b9c1
Create Date: 2026-06-05 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8c4e2f1d9b3'
down_revision: Union[str, None] = 'f6a3d2e8b9c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('participants', sa.JSON(), nullable=True))
    op.add_column('expenses', sa.Column('participant_amounts', sa.JSON(), nullable=True))
    op.create_table(
        'expense_participant_settlements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('expense_id', sa.Integer(), nullable=False),
        sa.Column('person_id', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('period', sa.Integer(), nullable=True),
        sa.Column('settled_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['expense_id'], ['expenses.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_expense_participant_settlements_id'), 'expense_participant_settlements', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_expense_participant_settlements_id'), table_name='expense_participant_settlements')
    op.drop_table('expense_participant_settlements')
    op.drop_column('expenses', 'participant_amounts')
    op.drop_column('expenses', 'participants')
