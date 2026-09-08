"""Editorial example: validate bounded UTF-8 JSON for an object-only endpoint.
No network calls. Callers must bound the transport body before buffering it.
Not a general JSON parser or application schema validator. Python 3.10+.
"""
import json


def json_object(status: int, content_type: str, body: bytes) -> dict:
    if not 200 <= status < 300 or status == 204:
        raise ValueError('response has no successful JSON-object contract')
    media_type = content_type.split(';', 1)[0].strip().lower()
    if media_type != 'application/json' and not (
        media_type.startswith('application/') and media_type.endswith('+json')
    ):
        raise ValueError('unexpected response media type')
    if len(body) > 65536:
        raise ValueError('example body limit exceeded')
    def reject_constant(value):
        raise ValueError('non-standard JSON constant')
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('duplicate member name')
            result[key] = value
        return result
    try:
        result = json.loads(body.decode('utf-8'), parse_constant=reject_constant,
                            object_pairs_hook=unique_object)
    except (UnicodeError, json.JSONDecodeError, RecursionError) as e:
        raise ValueError('invalid or excessively nested JSON') from e
    if not isinstance(result, dict):
        raise ValueError('endpoint requires an object')
    return result


if __name__ == '__main__':
    assert json_object(200, 'application/json; charset=utf-8', b'{"ok":true}') == {'ok': True}
    assert json_object(200, 'application/problem+json', b'{}') == {}
    cases = [
        (200, 'text/html', b'<html>login</html>'),
        (204, 'application/json', b''),
        (429, 'application/json', b'{"error":"rate"}'),
        (200, 'application/json', b'null'),
        (200, 'application/json', b'[]'),
        (200, 'application/json', b'{"a":1,"a":2}'),
        (200, 'application/json', b'{"x":NaN}'),
        (200, 'application/json', b'\xff'),
        (200, 'application/json', b'{'),
        (200, 'application/json', b' ' * 65537),
    ]
    for args in cases:
        try:
            json_object(*args)
        except ValueError:
            continue
        raise AssertionError('invalid response accepted')
    print('PASS: object and +json; HTML, status, empty, shape, duplicate, NaN, UTF-8, malformed and oversized rejection')
