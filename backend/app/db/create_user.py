import argparse

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import Role, User
from app.security.passwords import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update a WS3 user account")
    parser.add_argument("username")
    parser.add_argument("password")
    parser.add_argument("--name")
    parser.add_argument("--role", choices=("ADMIN", "PRODUCTION_MANAGER", "SUPERVISOR", "OPERATOR"))
    parser.add_argument("--machines", help="Comma-separated machine ids, for example SC-01,BU-01")
    args = parser.parse_args()
    if len(args.password) < 10:
        raise SystemExit("Password must contain at least 10 characters")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == args.username.strip().lower()))
        if user is None:
            user = User(username=args.username.strip().lower(), full_name=args.name or args.username.strip(), password_hash=hash_password(args.password), machine_ids=[])
            db.add(user)
        elif args.name is None and args.role is None and args.machines is None:
            user.password_hash = hash_password(args.password)
            user.is_active = True
            db.commit()
            print(f"Password updated: {args.username.strip().lower()}")
            return
        if args.name is not None:
            user.full_name = args.name
        user.password_hash = hash_password(args.password)
        user.is_active = True
        if args.machines is not None:
            user.machine_ids = [item.strip() for item in args.machines.split(",") if item.strip()]
        if args.role is not None:
            role = db.scalar(select(Role).where(Role.code == args.role))
            if role is None:
                role = Role(code=args.role, name=args.role.replace("_", " ").title())
                db.add(role)
                db.flush()
            user.roles = [role]
        db.commit()
    print(f"User account ready: {args.username.strip().lower()}")


if __name__ == "__main__":
    main()
