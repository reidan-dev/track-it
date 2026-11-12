"""add shared_tracker_rows/entries tables and users.share_token

Revision ID: a7c1e4f9b3d2
Revises: d5e9f3a7c2b6
Create Date: 2026-11-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c1e4f9b3d2'
down_revision: Union[str, None] = 'd5e9f3a7c2b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('share_token', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_share_token'), 'users', ['share_token'], unique=False)

    op.create_table(
        'shared_tracker_rows',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_table(
        'shared_tracker_entries',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('row_id', sa.Integer(), sa.ForeignKey('shared_tracker_rows.id'), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('shared_tracker_entries')
    op.drop_table('shared_tracker_rows')
    op.drop_index(op.f('ix_users_share_token'), table_name='users')
    op.drop_column('users', 'share_token')
