"""add role and permissions to invite_codes

Revision ID: b7e3a1f90c12
Revises: da3b0f22e094
Create Date: 2026-04-01 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e3a1f90c12'
down_revision: Union[str, None] = 'da3b0f22e094'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('invite_codes', schema=None) as batch_op:
        batch_op.add_column(sa.Column('role', sa.String(16), nullable=False, server_default='admin'))
        batch_op.add_column(sa.Column('permissions', sa.JSON(), nullable=False, server_default='{}'))


def downgrade() -> None:
    with op.batch_alter_table('invite_codes', schema=None) as batch_op:
        batch_op.drop_column('permissions')
        batch_op.drop_column('role')
