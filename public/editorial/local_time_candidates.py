"""Editorial example: make ambiguous/nonexistent local meeting times explicit."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def utc_candidates(local: datetime, zone: str) -> list[datetime]:
    if local.tzinfo is not None:
        raise ValueError('provide a naive wall-clock time plus a zone name')
    tz = ZoneInfo(zone)
    candidates = set()
    for fold in (0, 1):
        utc = local.replace(tzinfo=tz, fold=fold).astimezone(timezone.utc)
        if utc.astimezone(tz).replace(tzinfo=None) == local:
            candidates.add(utc)
    return sorted(candidates)


if __name__ == '__main__':
    zone = 'America/New_York'
    assert utc_candidates(datetime(2026, 3, 8, 2, 30), zone) == []
    repeated = utc_candidates(datetime(2026, 11, 1, 1, 30), zone)
    assert [d.isoformat() for d in repeated] == ['2026-11-01T05:30:00+00:00', '2026-11-01T06:30:00+00:00']
    ordinary = utc_candidates(datetime(2026, 9, 8, 9), zone)
    assert ordinary == [datetime(2026, 9, 8, 13, tzinfo=timezone.utc)]
    assert len(utc_candidates(datetime(2026, 9, 8, 9), 'Europe/Madrid')) == 1
    try:
        utc_candidates(datetime.now(timezone.utc), zone)
        raise AssertionError('aware wall time was accepted')
    except ValueError:
        pass
    print('PASS: daylight-saving gap, repeated hour, ordinary time, explicit input contract')
