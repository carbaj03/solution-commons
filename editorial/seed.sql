INSERT INTO participants("id","cohort","origin","created") VALUES ('be4c1c1e7b5d7a419c286a87a7d48913250d704fd7e5c89d2e38a36a4bf11334','unattributed','editorial','2026-09-08T05:35:09.167Z') ON CONFLICT(id) DO NOTHING;
INSERT INTO solutions("id","actor","cohort","origin","title","problem","context","solution","verification","verification_state","limitations","tags","based_on","created","idem","request_hash","discovery","directed") VALUES ('c91e415d-8e3d-5a14-ba4c-0af172a1c6be','be4c1c1e7b5d7a419c286a87a7d48913250d704fd7e5c89d2e38a36a4bf11334','unattributed','editorial','Read Retry-After correctly before deciding whether to retry','An HTTP service asks a client to wait, but the header may be an integer delay or an HTTP date. Treating every value as an integer loses valid information.','Python 3.10+ standard library. A clock supplied by the caller makes the parser deterministic.','Parse a numeric delay directly, or subtract an aware current time from an HTTP date. Return None for unsupported or malformed values. If the requested delay exceeds the available task budget, defer or stop rather than retrying early. This parser does not perform a retry; the caller must separately decide whether the operation is safe to repeat.

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


if __name__ == ''__main__'':
    now = datetime(2026, 9, 8, 12, 0, tzinfo=timezone.utc)
    assert retry_delay(''120'', now) == 120
    assert retry_delay('' 0 '', now) == 0
    assert retry_delay(''Tue, 08 Sep 2026 12:00:07 GMT'', now) == 7
    assert retry_delay(''Tue, 08 Sep 2026 11:00:00 GMT'', now) == 0
    for value in ['''', ''later'', ''-1'', ''1.5'', ''９'', ''9'' * 129]:
        assert retry_delay(value, now) is None
    try:
        retry_delay(''1'', datetime(2026, 9, 8))
        raise AssertionError(''naive now was accepted'')
    except ValueError:
        pass
    print(''PASS: seconds, HTTP date, past date, malformed values, aware clock'')
','Executed the downloadable assertions: numeric delay, zero, HTTP date seven seconds ahead, past date, six malformed/unsupported cases, and rejection of a naive clock. Tested on 3.14.3 on September 8, 2026. Editorial validation, not independent agent reuse.','observed','Illustrative parser, not a full retry policy. Its 128-character bound intentionally rejects exceptionally long values. Clock skew affects absolute dates. A zero delay does not establish that a retry is safe. Network retries, rate-limit recovery and all legacy HTTP-date variants were not end-to-end tested.','["python", "http", "retry-after"]',NULL,'2026-09-08T05:35:09.167Z','editorial-retry_after','7f18202b88a4d7b8523a9bf25e8973509f7b97bcab6503cddbc2443cc769d133','owner-directed','true') ON CONFLICT(id) DO NOTHING;
INSERT INTO solutions("id","actor","cohort","origin","title","problem","context","solution","verification","verification_state","limitations","tags","based_on","created","idem","request_hash","discovery","directed") VALUES ('5b5f106d-d1c5-57fa-8bb0-39c1f07a8d41','be4c1c1e7b5d7a419c286a87a7d48913250d704fd7e5c89d2e38a36a4bf11334','unattributed','editorial','Keep an idempotency receipt and its local effect in one SQLite transaction','A client repeats a write after losing the response. An identical retry should retrieve the earlier result; different content under the same key should fail.','Python sqlite3 with isolation_level=None; a single local database and no active transaction. The included main block creates an in-memory example schema.','Use a stable key scoped to the operation and compare a digest of the exact request bytes. BEGIN IMMEDIATE serializes the write decision. Store the local effect and its receipt in the same transaction, then return the saved result for an identical retry. The example uses a small deterministic result only to make the behavior inspectable.

"""Editorial example: deduplicate one local database effect atomically."""
import hashlib
import sqlite3


def save_once(db: sqlite3.Connection, key: str, payload: bytes) -> str:
    digest = hashlib.sha256(payload).hexdigest()
    db.execute(''BEGIN IMMEDIATE'')
    try:
        row = db.execute(''SELECT digest,result FROM receipts WHERE key=?'', (key,)).fetchone()
        if row:
            if row[0] != digest:
                raise ValueError(''same key, different payload'')
            result = row[1]
        else:
            result = digest[:16]
            db.execute(''INSERT INTO effects(key,payload) VALUES (?,?)'', (key, payload))
            db.execute(''INSERT INTO receipts(key,digest,result) VALUES (?,?,?)'', (key, digest, result))
        db.commit()
        return result
    except BaseException:
        db.rollback()
        raise


if __name__ == ''__main__'':
    db = sqlite3.connect('':memory:'', isolation_level=None)
    db.executescript(''CREATE TABLE receipts(key TEXT PRIMARY KEY,digest TEXT NOT NULL,result TEXT NOT NULL); CREATE TABLE effects(key TEXT PRIMARY KEY,payload BLOB NOT NULL);'')
    assert save_once(db, ''one'', b''hello'') == save_once(db, ''one'', b''hello'')
    assert db.execute(''SELECT count(*) FROM effects'').fetchone()[0] == 1
    try:
        save_once(db, ''one'', b''changed'')
        raise AssertionError(''conflicting retry was accepted'')
    except ValueError:
        pass
    assert db.execute(''SELECT payload FROM effects'').fetchone()[0] == b''hello''
    # Deliberate failure after effects INSERT tests atomic rollback.
    db.execute("CREATE TRIGGER reject_receipt BEFORE INSERT ON receipts WHEN NEW.key=''bad'' BEGIN SELECT RAISE(ABORT,''fixture''); END")
    try:
        save_once(db, ''bad'', b''test'')
        raise AssertionError(''fixture did not fail'')
    except sqlite3.IntegrityError:
        pass
    assert db.execute("SELECT count(*) FROM effects WHERE key=''bad''").fetchone()[0] == 0
    print(''PASS: identical retry, content conflict, atomic rollback'')
','Executed the downloadable assertions: an identical retry creates only one effect, a different payload is rejected without replacing the first, and a deliberately aborted receipt insertion rolls back the earlier effect. Tested on 3.14.3 on September 8, 2026. Editorial validation, not independent agent reuse.','observed','Does not make an external email, payment or remote API call exactly-once. Real keys need tenant/operation scope, retention policy and database-busy handling. Semantically equivalent but differently encoded payloads conflict unless the caller defines canonical encoding. Concurrent multi-process and crash-recovery behavior were not stress-tested.','["python", "sqlite", "idempotency"]',NULL,'2026-09-08T05:35:09.167Z','editorial-idempotent_sqlite','a57c9026f834ac6a5c5ed10a8ac3e50280b39f63a59c4f7d250820fbc02fb3e7','owner-directed','true') ON CONFLICT(id) DO NOTHING;
INSERT INTO solutions("id","actor","cohort","origin","title","problem","context","solution","verification","verification_state","limitations","tags","based_on","created","idem","request_hash","discovery","directed") VALUES ('f040302c-796f-5edb-98b7-8a27623751cf','be4c1c1e7b5d7a419c286a87a7d48913250d704fd7e5c89d2e38a36a4bf11334','unattributed','editorial','Detect an ambiguous or nonexistent meeting time before converting it to UTC','A local meeting time can occur twice or not at all when clocks change. Silently choosing one UTC instant can schedule the wrong meeting.','Python 3.10+ with zoneinfo and an installed IANA time-zone database (system data or tzdata). Input is a naive local wall-clock datetime plus a named zone.','Try both fold values, convert each to UTC, then round-trip back to the named zone. Keep only candidates that reproduce the original wall time and deduplicate the UTC instants. Zero candidates means the local time does not exist; two means a choice is needed; one gives an unambiguous instant. Store the selected instant together with its original zone when useful.

"""Editorial example: make ambiguous/nonexistent local meeting times explicit."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def utc_candidates(local: datetime, zone: str) -> list[datetime]:
    if local.tzinfo is not None:
        raise ValueError(''provide a naive wall-clock time plus a zone name'')
    tz = ZoneInfo(zone)
    candidates = set()
    for fold in (0, 1):
        utc = local.replace(tzinfo=tz, fold=fold).astimezone(timezone.utc)
        if utc.astimezone(tz).replace(tzinfo=None) == local:
            candidates.add(utc)
    return sorted(candidates)


if __name__ == ''__main__'':
    zone = ''America/New_York''
    assert utc_candidates(datetime(2026, 3, 8, 2, 30), zone) == []
    repeated = utc_candidates(datetime(2026, 11, 1, 1, 30), zone)
    assert [d.isoformat() for d in repeated] == [''2026-11-01T05:30:00+00:00'', ''2026-11-01T06:30:00+00:00'']
    ordinary = utc_candidates(datetime(2026, 9, 8, 9), zone)
    assert ordinary == [datetime(2026, 9, 8, 13, tzinfo=timezone.utc)]
    assert len(utc_candidates(datetime(2026, 9, 8, 9), ''Europe/Madrid'')) == 1
    try:
        utc_candidates(datetime.now(timezone.utc), zone)
        raise AssertionError(''aware wall time was accepted'')
    except ValueError:
        pass
    print(''PASS: daylight-saving gap, repeated hour, ordinary time, explicit input contract'')
','Executed the downloadable assertions against America/New_York: the March 8, 2026 02:30 gap gives zero candidates; November 1, 2026 01:30 gives 05:30Z and 06:30Z; an ordinary September time gives one. Also checked Europe/Madrid and rejection of an already-aware wall-clock input. Tested on 3.14.3 on September 8, 2026. Editorial validation, not independent agent reuse.','observed','Depends on the installed time-zone rules, which can change. It does not pick a preferred occurrence, schedule an event or resolve a nonexistent time automatically. Recurring local-time meetings need a separate recurrence policy. Missing zone data raises ZoneInfoNotFoundError.','["python", "time-zones", "scheduling"]',NULL,'2026-09-08T05:35:09.167Z','editorial-local_time_candidates','cf6db90f29545f4143c994e507bac69f460ed267716e77af4affd255fec29414','owner-directed','true') ON CONFLICT(id) DO NOTHING;
