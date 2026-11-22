from datetime import datetime, timedelta, timezone
import base64
import binascii
from pathlib import Path
from uuid import uuid4
from fastapi import Response
from fastapi.responses import FileResponse
from app.core.config import settings
from app.models.auth_session import AuthSession
from app.core.security import generate_refresh_token, hash_refresh_token
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.core.security import (
    create_access_token,
    hash_password,
)
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    ProfilePhotoUploadRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)
from app.services.auth_service import (
    authenticate_user,
)
from app.services.audit_log_service import (
    create_audit_log,
    get_request_ip,
)


router = APIRouter()


PROFILE_PHOTO_DIRECTORY = (
    Path(__file__).resolve().parents[4]
    / "storage"
    / "profile_photos"
)
MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024

PROFILE_PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _detect_profile_photo_extension(
    photo_bytes: bytes,
) -> str | None:
    if (
        len(photo_bytes) >= 3
        and photo_bytes[:3] == b"\xff\xd8\xff"
    ):
        return ".jpg"

    if photo_bytes.startswith(
        b"\x89PNG\r\n\x1a\n"
    ):
        return ".png"

    if (
        len(photo_bytes) >= 12
        and photo_bytes[:4] == b"RIFF"
        and photo_bytes[8:12] == b"WEBP"
    ):
        return ".webp"

    return None


def _delete_profile_photo_file(
    filename: str | None,
) -> None:
    if not filename:
        return

    safe_name = Path(filename).name

    if safe_name != filename:
        return

    path = (
        PROFILE_PHOTO_DIRECTORY
        / safe_name
    )

    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def _current_user_response(
    user: User,
) -> CurrentUserResponse:
    roles = sorted({
        role.name
        for role in user.roles
    })

    permissions = sorted({
        permission.code
        for role in user.roles
        for permission in role.permissions
    })

    return CurrentUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        contact_number=user.contact_number,
        has_profile_photo=bool(
            user.profile_photo_filename
        ),
        is_active=user.is_active,
        roles=roles,
        permissions=permissions,
    )


def _utcnow_naive() -> datetime:
    return datetime.now(
        timezone.utc
    ).replace(tzinfo=None)


def _refresh_cookie_path() -> str:
    return f"{settings.API_V1_PREFIX.rstrip('/')}/auth"


def _set_refresh_cookie(
    response: Response,
    raw_token: str,
) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=raw_token,
        max_age=(
            settings.REFRESH_SESSION_EXPIRE_HOURS
            * 60
            * 60
        ),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=_refresh_cookie_path(),
    )


def _delete_refresh_cookie(
    response: Response,
) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=_refresh_cookie_path(),
    )


def _get_session_from_cookie(
    request: Request,
    db: Session,
) -> AuthSession | None:
    raw_token = request.cookies.get(
        settings.REFRESH_COOKIE_NAME
    )

    if not raw_token:
        return None

    return db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash
            == hash_refresh_token(raw_token)
        )
    )


# =========================================================
# REGISTER
# =========================================================

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    registration: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # NORMALIZE INPUT
    # -----------------------------------------------------

    username = (
        registration.username
        .strip()
    )

    email = (
        str(registration.email)
        .strip()
        .lower()
    )

    first_name = (
        registration.first_name
        .strip()
    )

    last_name = (
        registration.last_name
        .strip()
    )


    # -----------------------------------------------------
    # PASSWORD CONFIRMATION
    # -----------------------------------------------------

    if (
        registration.password
        != registration.confirm_password
    ):
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )


    # -----------------------------------------------------
    # USERNAME CHECK
    # -----------------------------------------------------

    existing_username = db.scalar(
        select(User).where(
            User.username == username
        )
    )

    if existing_username:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Username is already "
                "registered."
            ),
        )


    # -----------------------------------------------------
    # EMAIL CHECK
    # -----------------------------------------------------

    existing_email = db.scalar(
        select(User).where(
            User.email == email
        )
    )

    if existing_email:
        raise HTTPException(
            status_code=
                status.HTTP_409_CONFLICT,
            detail=(
                "Email address is already "
                "registered."
            ),
        )


    # -----------------------------------------------------
    # ROLE CHECK
    # -----------------------------------------------------

    role = db.scalar(
        select(Role).where(
            Role.name ==
            registration.role_name
        )
    )

    if not role:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=(
                "The selected role is not "
                "configured in the system."
            ),
        )


    # -----------------------------------------------------
    # CREATE USER
    #
    # Self-registered users start inactive.
    # An administrator must approve the account.
    # -----------------------------------------------------

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(
            registration.password
        ),
        first_name=first_name,
        last_name=last_name,

        account_status="PENDING",
        is_active=False,
    )


    # -----------------------------------------------------
    # ASSIGN ROLE
    # -----------------------------------------------------

    user.roles.append(
        role
    )


    # -----------------------------------------------------
    # SAVE USER
    # -----------------------------------------------------

    try:
        db.add(user)
        create_audit_log(
            db,
            action="REGISTER",
            module="authentication",
            record_id=None,
            subject_label_snapshot=(
                f"@{username}"
            ),
            description=(
                "User registration submitted "
                f"for username {username}."
            ),
            ip_address=get_request_ip(request),
        )
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()
        raise


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return RegisterResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=role.name,
        is_active=user.is_active,
        message=(
            "Registration submitted successfully. "
            "Your account is awaiting "
            "administrator approval."
        ),
    )


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    # -----------------------------------------------------
    # AUTHENTICATE USER
    # -----------------------------------------------------

    user = authenticate_user(
        db,
        credentials.username,
        credentials.password,
    )

    # -----------------------------------------------------
    # FAILED LOGIN
    # -----------------------------------------------------

    if not user:
        create_audit_log(
            db,
            action="LOGIN_FAILED",
            module="authentication",
            description=(
                "Failed login attempt for "
                f"username or email "
                f"{credentials.username.strip()}."
            ),
            ip_address=get_request_ip(request),
        )

        try:
            db.commit()
        except Exception:
            db.rollback()
            raise

        raise HTTPException(
            status_code=
                status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Invalid username or password, "
                "or the account has not yet "
                "been approved."
            ),
        )

    # -----------------------------------------------------
    # CREATE ACCESS TOKEN
    # -----------------------------------------------------

    access_token = create_access_token(
        subject=str(user.id)
    )

    # -----------------------------------------------------
    # CREATE REFRESH SESSION
    # -----------------------------------------------------

    refresh_token = generate_refresh_token()
    now = _utcnow_naive()

    auth_session = AuthSession(
        user_id=user.id,
        token_hash=hash_refresh_token(
            refresh_token
        ),
        expires_at=(
            now
            + timedelta(
                hours=
                    settings
                    .REFRESH_SESSION_EXPIRE_HOURS
            )
        ),
    )

    # -----------------------------------------------------
    # SAVE SESSION + AUDIT LOG
    # -----------------------------------------------------

    try:
        db.add(auth_session)

        create_audit_log(
            db,
            action="LOGIN_SUCCESS",
            module="authentication",
            user=user,
            record_id=user.id,
            description=(
                "User signed in successfully."
            ),
            ip_address=get_request_ip(request),
        )

        db.commit()

    except Exception:
        db.rollback()
        raise

    # -----------------------------------------------------
    # SET HTTPONLY REFRESH COOKIE
    # -----------------------------------------------------

    _set_refresh_cookie(
        response,
        refresh_token,
    )

    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return TokenResponse(
        access_token=access_token,
    )


# =========================================================
# REFRESH ACCESS TOKEN
# =========================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    auth_session = _get_session_from_cookie(
        request,
        db,
    )
    now = _utcnow_naive()

    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or auth_session.expires_at <= now
    ):
        _delete_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
        )

    user = db.scalar(
        select(User).where(
            User.id == auth_session.user_id
        )
    )

    if (
        user is None
        or bool(getattr(user, "is_deleted", False))
        or not bool(getattr(user, "is_active", True))
        or getattr(user, "account_status", "ACTIVE") != "ACTIVE"
    ):
        auth_session.revoked_at = now
        db.commit()
        _delete_refresh_cookie(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is no longer valid.",
        )

    auth_session.last_used_at = now
    db.commit()

    return TokenResponse(
        access_token=create_access_token(
            subject=str(user.id)
        )
    )


# =========================================================
# LOGOUT
# =========================================================

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    auth_session = _get_session_from_cookie(
        request,
        db,
    )

    if (
        auth_session is not None
        and auth_session.revoked_at is None
    ):
        auth_session.revoked_at = _utcnow_naive()
        db.commit()

    _delete_refresh_cookie(response)

    return {
        "message": "Logged out successfully."
    }


# =========================================================
# CURRENT USER
# =========================================================

@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
def get_me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return _current_user_response(
        current_user
    )


# =========================================================
# UPDATE OWN PROFILE
# =========================================================

@router.patch(
    "/profile",
    response_model=CurrentUserResponse,
)
def update_own_profile(
    data: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    normalized_email = (
        str(data.email)
        .strip()
        .lower()
    )

    existing_email = db.scalar(
        select(User).where(
            func.lower(User.email)
            == normalized_email,
            User.id != current_user.id,
        )
    )

    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Email address is already "
                "used by another account."
            ),
        )

    changed_fields = []

    if current_user.first_name != data.first_name:
        changed_fields.append("first name")

    if current_user.last_name != data.last_name:
        changed_fields.append("last name")

    if current_user.email != normalized_email:
        changed_fields.append("email")

    if current_user.contact_number != data.contact_number:
        changed_fields.append("contact number")

    current_user.first_name = data.first_name
    current_user.last_name = data.last_name
    current_user.email = normalized_email
    current_user.contact_number = data.contact_number

    if changed_fields:
        create_audit_log(
            db,
            action="PROFILE_UPDATED",
            module="PROFILE",
            user=current_user,
            record_id=current_user.id,
            subject_label_snapshot=(
                f"@{current_user.username}"
            ),
            description=(
                "Updated own profile fields: "
                + ", ".join(changed_fields)
                + "."
            ),
            ip_address=get_request_ip(
                request
            ),
        )

    try:
        db.commit()
        db.refresh(current_user)
    except Exception:
        db.rollback()
        raise

    return _current_user_response(
        current_user
    )


# =========================================================
# GET OWN PROFILE PHOTO
# =========================================================

@router.get(
    "/profile-photo",
)
def get_own_profile_photo(
    current_user: User = Depends(
        get_current_user
    ),
):
    filename = current_user.profile_photo_filename

    if not filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile photo is set.",
        )

    safe_name = Path(filename).name

    if safe_name != filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile photo is unavailable.",
        )

    path = PROFILE_PHOTO_DIRECTORY / safe_name

    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile photo is unavailable.",
        )

    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(
        path.suffix.lower(),
        "application/octet-stream",
    )

    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=None,
    )


# =========================================================
# UPDATE OWN PROFILE PHOTO
# =========================================================

@router.put(
    "/profile-photo",
    response_model=CurrentUserResponse,
)
def update_own_profile_photo(
    data: ProfilePhotoUploadRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    declared_type = (
        data.content_type
        .strip()
        .lower()
    )

    declared_extension = PROFILE_PHOTO_TYPES.get(
        declared_type
    )

    if declared_extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Profile photo must be "
                "JPG, PNG, or WebP."
            ),
        )

    try:
        photo_bytes = base64.b64decode(
            data.data_base64,
            validate=True,
        )
    except (
        binascii.Error,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid profile photo data.",
        ) from exc

    if not photo_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile photo cannot be empty.",
        )

    if len(photo_bytes) > MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Profile photo must not exceed "
                "2 MB."
            ),
        )

    detected_extension = _detect_profile_photo_extension(
        photo_bytes
    )

    if (
        detected_extension is None
        or detected_extension != declared_extension
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The uploaded file does not "
                "match the selected image type."
            ),
        )

    PROFILE_PHOTO_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    new_filename = (
        f"user-{current_user.id}-"
        f"{uuid4().hex}"
        f"{detected_extension}"
    )

    new_path = (
        PROFILE_PHOTO_DIRECTORY
        / new_filename
    )

    old_filename = (
        current_user.profile_photo_filename
    )

    try:
        new_path.write_bytes(
            photo_bytes
        )

        current_user.profile_photo_filename = (
            new_filename
        )

        create_audit_log(
            db,
            action="PROFILE_PHOTO_UPDATED",
            module="PROFILE",
            user=current_user,
            record_id=current_user.id,
            subject_label_snapshot=(
                f"@{current_user.username}"
            ),
            description=(
                "Updated own profile photo."
            ),
            ip_address=get_request_ip(
                request
            ),
        )

        db.commit()
        db.refresh(current_user)

    except Exception:
        db.rollback()

        try:
            new_path.unlink(missing_ok=True)
        except OSError:
            pass

        raise

    _delete_profile_photo_file(
        old_filename
    )

    return _current_user_response(
        current_user
    )


# =========================================================
# REMOVE OWN PROFILE PHOTO
# =========================================================

@router.delete(
    "/profile-photo",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_own_profile_photo(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    old_filename = (
        current_user.profile_photo_filename
    )

    if not old_filename:
        return Response(
            status_code=status.HTTP_204_NO_CONTENT
        )

    current_user.profile_photo_filename = None

    create_audit_log(
        db,
        action="PROFILE_PHOTO_REMOVED",
        module="PROFILE",
        user=current_user,
        record_id=current_user.id,
        subject_label_snapshot=(
            f"@{current_user.username}"
        ),
        description=(
            "Removed own profile photo."
        ),
        ip_address=get_request_ip(
            request
        ),
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    _delete_profile_photo_file(
        old_filename
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )
