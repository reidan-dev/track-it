"""add held_by to shared_tracker_entries

Revision ID: c3f8a6d1e9b4
Revises: a7c1e4f9b3d2
Create Date: 2026-11-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3f8a6d1e9b4'
down_revision: Union[str, None] = 'a7c1e4f9b3d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shared_tracker_entries', sa.Column('held_by', sa.Integer(), sa.ForeignKey('people.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('shared_tracker_entries', 'held_by')
