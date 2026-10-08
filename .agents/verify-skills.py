#!/usr/bin/env python3
"""Verify the reviewed skill bundle using only the Python standard library."""

import hashlib
import json
from pathlib import Path
import sys


def main():
    base = Path(__file__).resolve().parent
    root = base / "skills"
    manifest = json.loads((base / "skill-files.json").read_text(encoding="utf-8"))
    expected_skills = {
        "impeccable", "frontend-design", "imagegen", "tailwind-design-system",
        "shadcn", "make-interfaces-feel-better", "web-design-guidelines",
    }
    errors = []
    expected = set()
    ignored_parts = {".impeccable", "__pycache__", "node_modules"}

    def linked(path):
        return path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction())

    for entry in manifest["files"]:
        relative = Path(entry["path"])
        if relative.is_absolute() or ".." in relative.parts:
            errors.append(f"Unsafe manifest path: {entry['path']}")
            continue
        key = relative.as_posix()
        if key in expected:
            errors.append(f"Duplicate manifest entry: {key}")
        expected.add(key)
        path = root / relative
        if any(linked(part) for part in (path, *path.parents)):
            errors.append(f"Linked file or parent: {key}")
            continue
        if not path.is_file():
            errors.append(f"Missing file: {key}")
            continue
        data = path.read_bytes()
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            errors.append(f"Changed file: {key}")

    actual = set()
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if any(part in ignored_parts for part in relative.parts):
            continue
        if linked(path):
            errors.append(f"Filesystem link: {relative.as_posix()}")
        if path.is_file():
            actual.add(relative.as_posix())
    for extra in sorted(actual - expected):
        errors.append(f"Unreviewed file: {extra}")
    for skill in sorted(expected_skills):
        if f"{skill}/SKILL.md" not in expected:
            errors.append(f"Missing skill: {skill}")
    for command in ("document", "critique"):
        if f"impeccable/reference/{command}.md" not in expected:
            errors.append(f"Missing Impeccable command: {command}")

    if errors:
        print("Skill verification failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print(f"PASS: {len(expected_skills)} skills, {len(expected)} reviewed files; all hashes match; no filesystem links.")
    print("Runtime tools, optional dependencies, and image-generation access require separate environment checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
