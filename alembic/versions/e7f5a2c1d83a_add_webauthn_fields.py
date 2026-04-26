"""add webauthn fields for multi-passkey support

Revision ID: e7f5a2c1d83a
Revises: 2b2c8787e6ca
Create Date: 2026-04-26 12:00:00.000000

"""
from typing import Sequence, Union
import os

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f5a2c1d83a'
down_revision: Union[str, None] = '2b2c8787e6ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('webauthn_user_handle', sa.LargeBinary(), nullable=True))
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM users WHERE webauthn_user_handle IS NULL")).fetchall()
    for row in rows:
        bind.execute(sa.text("UPDATE users SET webauthn_user_handle = :h WHERE id = :id"), {"h": os.urandom(64), "id": row[0]})
    with op.batch_alter_table('passkeys', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transports', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('aaguid', sa.String(36), nullable=True))
        batch_op.add_column(sa.Column('attestation_fmt', sa.String(64), nullable=True))
        batch_op.add_column(sa.Column('backup_eligible', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('backup_state', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('uv_initialized', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('non_uv_only', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('device_type', sa.String(16), nullable=True))
        batch_op.add_column(sa.Column('last_used_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('revoked_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('last_regression_at', sa.DateTime(), nullable=True))
        batch_op.create_index('ix_passkeys_user_revoked', ['user_id', 'revoked_at'])
    op.create_table(
        'webauthn_challenges',
        sa.Column('session_id', sa.String(64), primary_key=True),
        sa.Column('challenge', sa.LargeBinary(), nullable=False),
        sa.Column('kind', sa.String(16), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('expected_user_handle', sa.LargeBinary(), nullable=True),
        sa.Column('bridge_user_id', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_webauthn_challenges_expires_at', 'webauthn_challenges', ['expires_at'])


def downgrade() -> None:
    op.drop_index('ix_webauthn_challenges_expires_at', table_name='webauthn_challenges')
    op.drop_table('webauthn_challenges')
    with op.batch_alter_table('passkeys', schema=None) as batch_op:
        batch_op.drop_index('ix_passkeys_user_revoked')
        batch_op.drop_column('last_regression_at')
        batch_op.drop_column('revoked_at')
        batch_op.drop_column('last_used_at')
        batch_op.drop_column('device_type')
        batch_op.drop_column('non_uv_only')
        batch_op.drop_column('uv_initialized')
        batch_op.drop_column('backup_state')
        batch_op.drop_column('backup_eligible')
        batch_op.drop_column('attestation_fmt')
        batch_op.drop_column('aaguid')
        batch_op.drop_column('transports')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('webauthn_user_handle')
