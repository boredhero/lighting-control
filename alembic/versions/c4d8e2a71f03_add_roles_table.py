"""add roles table and role_id to users

Revision ID: c4d8e2a71f03
Revises: b7e3a1f90c12
Create Date: 2026-04-01 19:00:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d8e2a71f03'
down_revision: Union[str, None] = 'b7e3a1f90c12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ADMIN_ROLE_ID = str(uuid.uuid4())
USER_ROLE_ID = str(uuid.uuid4())
GUEST_ROLE_ID = str(uuid.uuid4())

ALL_PERMS = '{"can_control_devices": true, "can_execute_quick_actions": true, "can_manage_quick_actions": true, "can_view_schedules": true, "can_manage_schedules": true, "can_manage_devices": true, "can_manage_users": true}'
USER_PERMS = '{"can_control_devices": true, "can_execute_quick_actions": true, "can_manage_quick_actions": false, "can_view_schedules": true, "can_manage_schedules": false, "can_manage_devices": false, "can_manage_users": false}'
GUEST_PERMS = '{"can_control_devices": true, "can_execute_quick_actions": true, "can_manage_quick_actions": false, "can_view_schedules": true, "can_manage_schedules": false, "can_manage_devices": false, "can_manage_users": false}'


def upgrade() -> None:
    op.create_table(
        'roles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), unique=True, nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('is_guest', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('permissions', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.execute(f"INSERT INTO roles (id, name, is_system, is_admin, is_guest, permissions, sort_order) VALUES ('{ADMIN_ROLE_ID}', 'Admin', 1, 1, 0, '{ALL_PERMS}', 0)")
    op.execute(f"INSERT INTO roles (id, name, is_system, is_admin, is_guest, permissions, sort_order) VALUES ('{USER_ROLE_ID}', 'User', 1, 0, 0, '{USER_PERMS}', 1)")
    op.execute(f"INSERT INTO roles (id, name, is_system, is_admin, is_guest, permissions, sort_order) VALUES ('{GUEST_ROLE_ID}', 'Guest', 1, 0, 1, '{GUEST_PERMS}', 2)")
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('role_id', sa.String(36), nullable=True))
        batch_op.create_foreign_key('fk_users_role_id', 'roles', ['role_id'], ['id'])
    op.execute(f"UPDATE users SET role_id = '{ADMIN_ROLE_ID}' WHERE is_admin = 1")
    op.execute(f"UPDATE users SET role_id = '{GUEST_ROLE_ID}' WHERE is_guest = 1")
    op.execute(f"UPDATE users SET role_id = '{USER_ROLE_ID}' WHERE role_id IS NULL")
    with op.batch_alter_table('invite_codes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('role_id', sa.String(36), nullable=True))
        batch_op.create_foreign_key('fk_invite_codes_role_id', 'roles', ['role_id'], ['id'])
    op.execute(f"UPDATE invite_codes SET role_id = '{ADMIN_ROLE_ID}' WHERE role = 'admin'")
    op.execute(f"UPDATE invite_codes SET role_id = '{USER_ROLE_ID}' WHERE role_id IS NULL")
    with op.batch_alter_table('invite_codes', schema=None) as batch_op:
        batch_op.drop_column('role')
        batch_op.drop_column('permissions')


def downgrade() -> None:
    with op.batch_alter_table('invite_codes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('role', sa.String(16), nullable=False, server_default='admin'))
        batch_op.add_column(sa.Column('permissions', sa.JSON(), nullable=False, server_default='{}'))
        batch_op.drop_column('role_id')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('role_id')
    op.drop_table('roles')
