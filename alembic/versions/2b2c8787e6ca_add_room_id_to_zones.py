"""add room_id to zones

Revision ID: 2b2c8787e6ca
Revises: c4d8e2a71f03
Create Date: 2026-04-02 00:30:01.329834

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b2c8787e6ca'
down_revision: Union[str, None] = 'c4d8e2a71f03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM zones")
    op.execute("UPDATE devices SET zone_id = NULL")
    with op.batch_alter_table('zones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('room_id', sa.String(length=36), nullable=False))
        batch_op.create_foreign_key('fk_zones_room_id', 'rooms', ['room_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('zones', schema=None) as batch_op:
        batch_op.drop_constraint('fk_zones_room_id', type_='foreignkey')
        batch_op.drop_column('room_id')
