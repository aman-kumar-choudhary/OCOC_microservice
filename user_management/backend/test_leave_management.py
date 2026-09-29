from app.core.security import Claims
from app.routers.leave import STAGE_PERMISSIONS, can_approve, json_value


def test_leave_approval_permissions_follow_keycloak_roles():
    assert can_approve(Claims("warden", roles=["WARDEN"]), "leave.approve.warden")
    assert can_approve(Claims("admin", roles=["SUPER_ADMIN"]), "leave.approve.chancellor")
    assert not can_approve(Claims("student", roles=["STUDENT"]), "leave.approve.warden")


def test_known_leave_workflow_permissions_are_whitelisted():
    assert STAGE_PERMISSIONS == {
        "leave.approve.warden",
        "leave.approve.chancellor",
        "leave.approve.medical",
    }


def test_asyncpg_json_values_are_normalized():
    assert json_value('["leave.approve.warden"]') == ["leave.approve.warden"]
    assert json_value({"key": "value"}) == {"key": "value"}
