"""Editorial example: deduplicate one local database effect atomically."""
import hashlib
import sqlite3


def save_once(db: sqlite3.Connection, key: str, payload: bytes) -> str:
    digest = hashlib.sha256(payload).hexdigest()
    db.execute('BEGIN IMMEDIATE')
    try:
        row = db.execute('SELECT digest,result FROM receipts WHERE key=?', (key,)).fetchone()
        if row:
            if row[0] != digest:
                raise ValueError('same key, different payload')
            result = row[1]
        else:
            result = digest[:16]
            db.execute('INSERT INTO effects(key,payload) VALUES (?,?)', (key, payload))
            db.execute('INSERT INTO receipts(key,digest,result) VALUES (?,?,?)', (key, digest, result))
        db.commit()
        return result
    except BaseException:
        db.rollback()
        raise


if __name__ == '__main__':
    db = sqlite3.connect(':memory:', isolation_level=None)
    db.executescript('CREATE TABLE receipts(key TEXT PRIMARY KEY,digest TEXT NOT NULL,result TEXT NOT NULL); CREATE TABLE effects(key TEXT PRIMARY KEY,payload BLOB NOT NULL);')
    assert save_once(db, 'one', b'hello') == save_once(db, 'one', b'hello')
    assert db.execute('SELECT count(*) FROM effects').fetchone()[0] == 1
    try:
        save_once(db, 'one', b'changed')
        raise AssertionError('conflicting retry was accepted')
    except ValueError:
        pass
    assert db.execute('SELECT payload FROM effects').fetchone()[0] == b'hello'
    # Deliberate failure after effects INSERT tests atomic rollback.
    db.execute("CREATE TRIGGER reject_receipt BEFORE INSERT ON receipts WHEN NEW.key='bad' BEGIN SELECT RAISE(ABORT,'fixture'); END")
    try:
        save_once(db, 'bad', b'test')
        raise AssertionError('fixture did not fail')
    except sqlite3.IntegrityError:
        pass
    assert db.execute("SELECT count(*) FROM effects WHERE key='bad'").fetchone()[0] == 0
    print('PASS: identical retry, content conflict, atomic rollback')
