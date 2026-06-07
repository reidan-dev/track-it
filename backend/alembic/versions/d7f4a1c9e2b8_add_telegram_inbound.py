"""add telegram inbound: webhook secret, digest settings, conversation state

Revision ID: d7f4a1c9e2b8
Revises: f1a2b3c4d5e6
Create Date: 2026-06-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7f4a1c9e2b8'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SETTINGS_COLUMNS = [
    ('telegram_webhook_secret', sa.String()),
    ('digest_enabled', sa.Boolean()),
    ('digest_frequency', sa.String()),
    ('digest_time', sa.String()),
    ('digest_weekday', sa.Integer()),
    ('digest_last_sent', sa.String()),
]


def upgrade() -> None:
    for name, type_ in SETTINGS_COLUMNS:
        op.add_column('user_settings', sa.Column(name, type_, nullable=True))
    op.create_index('ix_user_settings_telegram_webhook_secret', 'user_settings', ['telegram_webhook_secret'])

    op.create_table(
        'telegram_conversations',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('chat_id', sa.String(), nullable=False),
        sa.Column('flow', sa.String(), nullable=True),
        sa.Column('step', sa.String(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('prompt_message_id', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('user_id', 'chat_id', name='uq_telegram_conv_user_chat'),
    )
    op.create_index('ix_telegram_conversations_chat_id', 'telegram_conversations', ['chat_id'])


def downgrade() -> None:
    op.drop_index('ix_telegram_conversations_chat_id', table_name='telegram_conversations')
    op.drop_table('telegram_conversations')
    op.drop_index('ix_user_settings_telegram_webhook_secret', table_name='user_settings')
    for name, _ in reversed(SETTINGS_COLUMNS):
        op.drop_column('user_settings', name)
