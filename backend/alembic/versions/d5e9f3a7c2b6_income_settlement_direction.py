"""add direction to income participant settlements

Revision ID: d5e9f3a7c2b6
Revises: c4d8e6f2a9b1
Create Date: 2026-09-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e9f3a7c2b6'
down_revision: Union[str, None] = 'c4d8e6f2a9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('income_participant_settlements', sa.Column('direction', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('income_participant_settlements', 'direction')
