"""add user profile fields

Revision ID: d7e5c4a29f31
Revises: 11b1c762f632
Create Date: 2026-09-09 04:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e5c4a29f31"
down_revision: Union[str, Sequence[str], None] = "11b1c762f632"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "contact_number",
            sa.String(length=20),
            nullable=True,
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "profile_photo_filename",
            sa.String(length=255),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "users",
        "profile_photo_filename",
    )

    op.drop_column(
        "users",
        "contact_number",
    )
