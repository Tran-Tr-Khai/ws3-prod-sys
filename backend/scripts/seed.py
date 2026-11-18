from app.db.seed import seed_initial_data
from app.db.session import SessionLocal


def main() -> None:
    """Create the baseline roles required by the application."""
    with SessionLocal() as session:
        seed_initial_data(session)
    print("Initial roles seeded.")


if __name__ == "__main__":
    main()
