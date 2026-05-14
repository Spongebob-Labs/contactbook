#!/usr/bin/env python3
"""Convert a dotenv file to JSON for `gcloud run services update --env-vars-file`.

Cloud Run accepts YAML or JSON; JSON avoids YAML quoting edge cases (e.g. CORS commas).
Reads UTF-8 from argv[1], writes JSON to argv[2]. Stdlib only.
"""
from __future__ import annotations

import json
import re
import sys


def _unescape(s: str) -> str:
    return (
        s.replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
        .replace('\\"', '"')
        .replace("\\\\", "\\")
    )


def _parse_double_quoted(rest: str) -> str:
    """rest starts with opening double quote."""
    i = 1
    out: list[str] = []
    while i < len(rest):
        c = rest[i]
        if c == "\\" and i + 1 < len(rest):
            out.append(rest[i : i + 2])
            i += 2
            continue
        if c == '"':
            return _unescape("".join(out))
        out.append(c)
        i += 1
    return _unescape("".join(out))


def parse_dotenv(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
            if not m:
                continue
            key, rest = m.group(1), m.group(2)
            rest = rest.rstrip()
            if not rest:
                val = ""
            elif rest[0] == '"':
                val = _parse_double_quoted(rest)
            elif rest[0] == "'":
                if len(rest) >= 2 and rest.endswith("'"):
                    val = rest[1:-1]
                else:
                    val = rest[1:]
            else:
                val = rest.split(" #", 1)[0].strip()
                if "#" in val and not val.startswith('"'):
                    val = val.split("#", 1)[0].strip()
            env[key] = val
    return env


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: dotenv-to-gcloud-env-json.py <input.env> <output.json>", file=sys.stderr)
        sys.exit(2)
    inp, outp = sys.argv[1], sys.argv[2]
    data = parse_dotenv(inp)
    with open(outp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    main()
