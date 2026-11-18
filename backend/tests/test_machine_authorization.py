"""Regression tests for the shared machine-access policy."""

import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from app.security.authorization import require_machine_access


def user(*roles: str, machine_ids: list[str] | None = None):
    """Build the smallest user shape consumed by the authorization helper."""
    return SimpleNamespace(
        roles=[SimpleNamespace(code=role) for role in roles],
        machine_ids=machine_ids or [],
    )


class MachineAuthorizationTests(unittest.TestCase):
    def test_manager_can_access_any_supported_machine(self):
        self.assertEqual(require_machine_access(user("SUPERVISOR"), "te-01"), "TE-01")

    def test_operator_can_access_only_an_assigned_machine(self):
        self.assertEqual(require_machine_access(user("OPERATOR", machine_ids=["BU-01"]), "bu-01"), "BU-01")
        with self.assertRaises(HTTPException) as error:
            require_machine_access(user("OPERATOR", machine_ids=["BU-01"]), "TE-01")
        self.assertEqual(error.exception.status_code, 403)

    def test_unknown_machine_is_not_treated_as_a_permission_failure(self):
        with self.assertRaises(HTTPException) as error:
            require_machine_access(user("ADMIN"), "UNKNOWN")
        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
