"""add earner/participants/splits + settlements to income

Revision ID: b3f7a1c9d4e2
Revises: c7e2a9f4b1d8
Create Date: 2026-09-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3f7a1c9d4e2'
down_revision: Union[str, None] = 'c7e2a9f4b1d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('incomes', sa.Column('earned_by', sa.Integer(), nullable=True))
    op.add_column('incomes', sa.Column('participants', sa.JSON(), nullable=True))
    op.add_column('incomes', sa.Column('participant_amounts', sa.JSON(), nullable=True))
    op.create_table(
        'income_participant_settlements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('income_id', sa.Integer(), nullable=False),
        sa.Column('person_id', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('period', sa.Integer(), nullable=True),
        sa.Column('settled_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['income_id'], ['incomes.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_income_participant_settlements_id'), 'income_participant_settlements', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_income_participant_settlements_id'), table_name='income_participant_settlements')
    op.drop_table('income_participant_settlements')
    op.drop_column('incomes', 'participant_amounts')
    op.drop_column('incomes', 'participants')
    op.drop_column('incomes', 'earned_by')
