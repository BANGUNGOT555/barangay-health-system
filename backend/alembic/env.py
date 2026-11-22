from logging.config import fileConfig

from alembic import context
from sqlalchemy import (
    engine_from_config,
    pool,
)

from app.core.config import settings
from app.db.base import Base

# Import all ORM models so they are registered
# in Base.metadata before Alembic autogenerate runs.
import app.models  # noqa: F401


# =========================================================
# ALEMBIC CONFIGURATION
# =========================================================

config = context.config


# =========================================================
# DATABASE URL
# =========================================================

config.set_main_option(
    "sqlalchemy.url",
    settings.database_url.replace(
        "%",
        "%%",
    ),
)


# =========================================================
# LOGGING
# =========================================================

if config.config_file_name is not None:
    fileConfig(
        config.config_file_name
    )


# =========================================================
# SQLALCHEMY METADATA
# =========================================================

target_metadata = Base.metadata


# =========================================================
# OFFLINE MIGRATIONS
# =========================================================

def run_migrations_offline() -> None:
    """
    Run migrations without creating
    a live database connection.
    """

    url = config.get_main_option(
        "sqlalchemy.url"
    )

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# =========================================================
# ONLINE MIGRATIONS
# =========================================================


def run_migrations_online() -> None:
    """
    Run migrations using a live
    database connection.
    """

    connect_args = {}

    if settings.DATABASE_SSL:
        if not settings.DATABASE_SSL_CA:
            raise ValueError(
                "DATABASE_SSL_CA must be configured "
                "when DATABASE_SSL is enabled."
            )

        connect_args.update({
            "ssl_ca": settings.DATABASE_SSL_CA,
            "ssl_verify_cert": True,
            "ssl_verify_identity": True,
        })

    connectable = engine_from_config(
        config.get_section(
            config.config_ini_section,
            {},
        ),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()



# =========================================================
# RUN MIGRATIONS
# =========================================================

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()