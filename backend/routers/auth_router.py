from fastapi import APIRouter, HTTPException, Depends, status
from backend.database import get_db, record_activity
from backend.models import UserRegister, UserLogin, UserResponse, Token
from backend.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username = ?", (data.username,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered. Please choose another username."
            )
        
        hashed = hash_password(data.password)
        cursor.execute("""
            INSERT INTO users (username, hashed_password, role)
            VALUES (?, ?, 'user')
        """, (data.username, hashed))
        user_id = cursor.lastrowid

        cursor.execute("SELECT id, username, role, created_at FROM users WHERE id = ?", (user_id,))
        new_user = dict(cursor.fetchone())

        record_activity(
            conn,
            event_type="USER",
            title=f"New user registered: {data.username}",
            details="Account created successfully"
        )

    token = create_access_token(data={"sub": new_user["username"], "id": new_user["id"]})
    return Token(access_token=token, token_type="bearer", user=UserResponse(**new_user))

@router.post("/login", response_model=Token)
def login(data: UserLogin):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, hashed_password, role, created_at FROM users WHERE username = ?", (data.username,))
        row = cursor.fetchone()
        if not row or not verify_password(data.password, row["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password."
            )
        
        user = dict(row)
        record_activity(
            conn,
            event_type="USER",
            title=f"User login: {user['username']}",
            details="Authenticated via JWT"
        )

    token = create_access_token(data={"sub": user["username"], "id": user["id"]})
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        created_at=user["created_at"]
    )
    return Token(access_token=token, token_type="bearer", user=user_response)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        role=current_user["role"],
        created_at=current_user["created_at"]
    )
