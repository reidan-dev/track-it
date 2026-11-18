"""shared tracker type and split

Revision ID: f7a2c9e4b1d8
Revises: b4e7f2c8a1d3
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a2c9e4b1d8'
down_revision: Union[str, None] = 'b4e7f2c8a1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shared_tracker_rows', sa.Column('row_type', sa.String(), nullable=True))
    op.add_column('shared_tracker_rows', sa.Column('due_day', sa.Integer(), nullable=True))
    op.add_column('shared_tracker_rows', sa.Column('total_terms', sa.Integer(), nullable=True))
    op.add_column('shared_tracker_rows', sa.Column('linked_master_id', sa.Integer(), nullable=True))
    op.add_column('shared_tracker_entries', sa.Column('participants', sa.JSON(), nullable=True))
    op.add_column('shared_tracker_entries', sa.Column('participant_amounts', sa.JSON(), nullable=True))
    op.add_column('shared_tracker_entries', sa.Column('linked_record_type', sa.String(), nullable=True))
    op.add_column('shared_tracker_entries', sa.Column('linked_record_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('shared_tracker_entries', 'linked_record_id')
    op.drop_column('shared_tracker_entries', 'linked_record_type')
    op.drop_column('shared_tracker_entries', 'participant_amounts')
    op.drop_column('shared_tracker_entries', 'participants')
    op.drop_column('shared_tracker_rows', 'linked_master_id')
    op.drop_column('shared_tracker_rows', 'total_terms')
    op.drop_column('shared_tracker_rows', 'due_day')
    op.drop_column('shared_tracker_rows', 'row_type')
