#!/usr/bin/env python3
"""
Check that no entry in collection.json duplicates an archived repository.

Compares each collection entry's top-level URL and name against the
entries in data/archived_repos.json. A collection entry must not reuse a URL
or name that has been archived. Also checks the archived list itself for
duplicate URLs or names.
"""
import json
import sys


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    collection_path = sys.argv[1] if len(sys.argv) > 1 else "data/collection.json"
    archived_path = sys.argv[2] if len(sys.argv) > 2 else "data/archived_repos.json"

    try:
        collection = load_json(collection_path)
    except FileNotFoundError:
        print(f"ERROR: File '{collection_path}' not found")
        return False
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in '{collection_path}': {e}")
        return False

    try:
        archived = load_json(archived_path)
    except FileNotFoundError:
        print(f"ERROR: File '{archived_path}' not found")
        return False
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in '{archived_path}': {e}")
        return False

    if not isinstance(collection, list):
        print("ERROR: collection.json root must be an array")
        return False
    if not isinstance(archived, list):
        print("ERROR: archived_repos.json root must be an array")
        return False

    archived_urls = {str(e.get("url", "")).strip().lower() for e in archived if isinstance(e, dict)}
    archived_names = {str(e.get("name", "")).strip().lower() for e in archived if isinstance(e, dict)}

    # Duplicate checks within archived list
    errors = []
    seen_urls = set()
    seen_names = set()
    for i, entry in enumerate(archived):
        if not isinstance(entry, dict):
            errors.append(f"ERROR: Archived entry at index {i} is not an object")
            continue
        url = str(entry.get("url", "")).strip().lower()
        name = str(entry.get("name", "")).strip().lower()
        if url and url in seen_urls:
            errors.append(f"ERROR: Duplicate archived URL: {entry.get('url')}")
        if name and name in seen_names:
            errors.append(f"ERROR: Duplicate archived name: {entry.get('name')}")
        seen_urls.add(url)
        seen_names.add(name)

    # Collection entries must not overlap with archived data
    for i, entry in enumerate(collection):
        if not isinstance(entry, dict):
            errors.append(f"ERROR: Collection entry at index {i} is not an object")
            continue
        url = str(entry.get("url", "")).strip().lower()
        name = str(entry.get("name", "")).strip().lower()
        if url and url in archived_urls:
            errors.append(
                f"ERROR: Collection entry '{entry.get('name')}' (index {i}) "
                f"reuses an archived URL: {entry.get('url')}"
            )
        if name and name in archived_names:
            errors.append(
                f"ERROR: Collection entry '{entry.get('name')}' (index {i}) "
                f"reuses an archived name"
            )

    if errors:
        for e in errors:
            print(e)
        print(f"FAILURE: Found {len(errors)} issue(s) checking {len(collection)} collection entries against {len(archived)} archived entries.")
        return False

    print(f"SUCCESS: No collection entries duplicate archived repositories (checked {len(collection)} collection entries against {len(archived)} archived entries).")
    return True


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
PY