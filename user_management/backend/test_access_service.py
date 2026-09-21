import datetime

from app.services.access_service import AccessService


def test_rule_time_window_accepts_current_time():
    now = datetime.datetime(2026, 1, 5, 10, 0, tzinfo=datetime.timezone.utc)  # Monday
    rule = {"valid_from": None, "valid_to": None, "schedule_days": [1],
            "schedule_start_time": datetime.time(9, 0), "schedule_end_time": datetime.time(17, 0)}
    assert AccessService._rule_is_current(rule, now)


def test_rule_time_window_rejects_wrong_day():
    now = datetime.datetime(2026, 1, 6, 10, 0, tzinfo=datetime.timezone.utc)  # Tuesday
    rule = {"valid_from": None, "valid_to": None, "schedule_days": [1],
            "schedule_start_time": None, "schedule_end_time": None}
    assert not AccessService._rule_is_current(rule, now)
