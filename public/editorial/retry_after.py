"""Editorial example: parse a Retry-After value; does not issue requests."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


def retry_delay(value: str, now: datetime) -> float | None:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    value = value.strip()
    if not value or len(value) > 128:
        return None
    if value.isascii() and value.isdigit():
        return float(int(value))
    try:
        target = parsedate_to_datetime(value)
    except (ValueError, TypeError, OverflowError):
        return None
    if target.tzinfo is None:
        return None
    return max(0.0, (target - now).total_seconds())


if __name__ == '__main__':
    now = datetime(2026, 9, 8, 12, 0, tzinfo=timezone.utc)
    assert retry_delay('120', now) == 120
    assert retry_delay(' 0 ', now) == 0
    assert retry_delay('Tue, 08 Sep 2026 12:00:07 GMT', now) == 7
    assert retry_delay('Tue, 08 Sep 2026 11:00:00 GMT', now) == 0
    for value in ['', 'later', '-1', '1.5', '９', '9' * 129]:
        assert retry_delay(value, now) is None
    try:
        retry_delay('1', datetime(2026, 9, 8))
        raise AssertionError('naive now was accepted')
    except ValueError:
        pass
    print('PASS: seconds, HTTP date, past date, malformed values, aware clock')
