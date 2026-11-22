
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


connect_args = {}

if settings.DATABASE_SSL:
    if not settings.DATABASE_SSL_CA:
        raise ValueError(
            "DATABASE_SSL_CA must be configured when DATABASE_SSL is enabled."
        )

    connect_args.update({
        "ssl_ca": settings.DATABASE_SSL_CA,
        "ssl_verify_cert": True,
        "ssl_verify_identity": True,
    })


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)
