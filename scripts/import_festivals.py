#!/usr/bin/env python3
"""
Generate Vaishnava festival dates and emit SQL to load them into `festivals`.

Uses the `gaurabda` library (MIT), which computes tithis from astronomical
rules for a given latitude/longitude - so Ekadasi comes out on the right civil
date for Lagos as well as Vrindavan, which a single global list cannot do.

Nothing is scraped and nothing here needs a secret: locations are read with the
public anon key (they are public data), and the output is a .sql file you run
in the Supabase SQL editor.

    python3 -m venv .venv && ./.venv/bin/pip install gaurabda requests
    ./.venv/bin/python scripts/import_festivals.py --years 2026 2027 2028

Writes supabase/festivals_generated.sql
"""

from __future__ import annotations

import argparse
import os
import pathlib
import sys
import urllib.request
import json

try:
    import gaurabda as g
except ImportError:
    sys.exit("gaurabda is not installed.  pip install gaurabda")

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "supabase" / "festivals_generated.sql"


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env.local"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


def fetch_locations(env: dict[str, str]) -> list[dict]:
    url = env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or os.environ.get(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    )
    if not url or not key:
        sys.exit("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local")

    req = urllib.request.Request(
        f"{url}/rest/v1/locations?select=id,name,tz,lat,lon",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# gaurabda names its zones "<offset> <IANA>" and still uses some pre-2008
# spellings, so an IANA id from the database has to be resolved against its
# own table rather than passed straight through.
TZ_ALIASES = {
    "Asia/Kolkata": "Asia/Calcutta",
    "Asia/Ho_Chi_Minh": "Asia/Saigon",
    "Europe/Kyiv": "Europe/Kiev",
    "America/Argentina/Buenos_Aires": "America/Buenos_Aires",
}


def resolve_tzname(iana: str) -> str:
    table = g.GetTimeZones()
    for candidate in (iana, TZ_ALIASES.get(iana, "")):
        if not candidate:
            continue
        for entry in table:
            if entry.split(" ", 1)[-1] == candidate:
                return entry
    raise SystemExit(
        f"gaurabda does not know the timezone {iana!r}. "
        f"Add an alias for it to TZ_ALIASES in {__file__}."
    )


def classify(text: str, is_ekadasi: bool) -> str:
    low = text.lower()
    # Astronomical bookkeeping, not an observance. Left in the table because it
    # is occasionally useful, but typed so the calendar can hide it by default.
    if low.startswith(("ksaya tithi", "vriddhi tithi")) or "caturmasya" in low:
        return "note"
    if is_ekadasi or "ekadasi" in low or "ekadashi" in low:
        return "ekadasi"
    # "disappearance" contains "appearance", so it has to be tested first.
    # gaurabda writes these as "Sri Ramacandra Kaviraja -- Disappearance",
    # not "Disappearance of ...", so match the bare word.
    if "disappearance" in low:
        return "disappearance"
    if "appearance" in low:
        return "appearance"
    return "festival"


def festivals_for(loc: dict, year: int) -> list[tuple[str, str, str, str | None]]:
    """-> [(date, name, festival_type, fasting_note)]"""
    gloc = g.GCLocation(
        data={
            "latitude": float(loc["lat"]),
            "longitude": float(loc["lon"]),
            "tzname": resolve_tzname(loc["tz"]),
            "name": loc["name"],
        }
    )
    days = 366 if year % 4 == 0 else 365
    cal = g.TCalendar()
    cal.CalculateCalendar(gloc, g.GCGregorianDate(year=year, month=1, day=1), days)

    out: list[tuple[str, str, str, str | None]] = []
    for i in range(days):
        day = cal.GetDay(i)
        d = day.date
        if d.year != year:
            continue
        iso = f"{d.year:04d}-{d.month:02d}-{d.day:02d}"

        is_ekadasi = bool(getattr(day, "ekadasi_vrata_name", "") or "")
        # Entries wrapped in parentheses - "(Fast today)" - annotate the event
        # above them rather than standing as festivals of their own.
        note: str | None = None
        pending: list[tuple[str, str]] = []

        for ev in day.dayEvents or []:
            text = (ev.get("text") or "").strip()
            if not text:
                continue
            if text.startswith("("):
                note = text.strip("()")
                continue
            if text.lower().startswith("break fast"):
                # The Ekadasi parana window - a note about the day, not an
                # observance in its own right.
                note = text
                continue
            pending.append((text, classify(text, is_ekadasi)))

        for text, kind in pending:
            out.append((iso, text, kind, note))

        if is_ekadasi and not any(k == "ekadasi" for _, k in pending):
            out.append((iso, f"{day.ekadasi_vrata_name} Ekadasi", "ekadasi", note))
        elif note and note.lower().startswith("break fast") and not pending:
            out.append((iso, "Ekadasi parana (break fast)", "fasting", note))

    return out


def sql_quote(v: str | None) -> str:
    return "null" if v is None else "'" + v.replace("'", "''") + "'"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", nargs="+", type=int, default=[2026, 2027, 2028])
    args = ap.parse_args()

    locations = fetch_locations(read_env())
    usable = [l for l in locations if l.get("lat") is not None and l.get("lon") is not None]
    skipped = [l["name"] for l in locations if l not in usable]

    header = [
        "-- Generated by scripts/import_festivals.py - do not edit by hand.",
        "-- Source: gaurabda (MIT), computed per location from lat/lon.",
        "",
    ]
    values: list[str] = []

    for loc in usable:
        for year in args.years:
            rows = festivals_for(loc, year)
            print(f"  {loc['name']:<12} {year}  {len(rows):>3} entries", file=sys.stderr)
            for iso, name, kind, note in rows:
                values.append(
                    f"  ('{loc['id']}', '{iso}', {sql_quote(name)}, "
                    f"'{kind}', {sql_quote(note)}, 'gaurabda')"
                )

    total = len(values)
    # One statement per 500 rows: small enough to paste into the SQL editor,
    # few enough statements that the file stays readable.
    lines = list(header)
    for i in range(0, total, 500):
        chunk = values[i : i + 500]
        lines.append(
            "insert into festivals (location_id, date, name, festival_type, fasting_note, source)\nvalues"
        )
        lines.append(",\n".join(chunk))
        lines.append(
            "on conflict (location_id, date, name) do update\n"
            "  set festival_type = excluded.festival_type,\n"
            "      fasting_note  = excluded.fasting_note;\n"
        )

    OUT.write_text("\n".join(lines) + "\n")
    print(f"\nWrote {total} rows to {OUT.relative_to(ROOT)}", file=sys.stderr)
    if skipped:
        print(f"Skipped (no lat/lon set): {', '.join(skipped)}", file=sys.stderr)


if __name__ == "__main__":
    main()
