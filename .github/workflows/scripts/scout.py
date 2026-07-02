#!/usr/bin/env python3
import os
import json
from datetime import datetime
from urllib.parse import urlparse
from github import Github

SCOUT_SUGGESTED_LIST_PATH = "data/scout_suggested.json"


def extract_github_repo(url):
    """Extract normalized owner/repo from a GitHub URL.

    Handles URLs with fragments, query strings, and .git suffixes.
    Returns None if the URL is not a valid GitHub repo URL.
    """
    if not url or 'github.com' not in url:
        return None

    try:
        parsed = urlparse(url)
        if parsed.netloc != 'github.com':
            return None

        path = parsed.path.strip('/')
        if not path:
            return None

        if path.endswith('.git'):
            path = path[:-4]

        segments = path.split('/')
        if len(segments) >= 2:
            return f"{segments[0]}/{segments[1]}".lower()

        return None
    except Exception:
        return None


def load_collection_repos():
    """Load GitHub repos already listed in collection.json."""
    repos = set()
    try:
        if os.path.exists('data/collection.json'):
            with open('data/collection.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    url = item.get('url', '')
                    repo = extract_github_repo(url)
                    if repo:
                        repos.add(repo)

                    if 'references' in item and isinstance(item['references'], list):
                        for ref in item['references']:
                            if isinstance(ref, dict) and 'url' in ref:
                                repo = extract_github_repo(ref['url'])
                                if repo:
                                    repos.add(repo)
    except Exception as e:
        print(f"Warning: Could not load collection.json: {e}")
    return repos


def load_scout_suggested_list():
    """
    Load the persistent scout-suggested list from data/scout_suggested.json.
    Repos already in this list are not reported again.
    """
    if not os.path.exists(SCOUT_SUGGESTED_LIST_PATH):
        return [], set()

    try:
        with open(SCOUT_SUGGESTED_LIST_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Failed to load {SCOUT_SUGGESTED_LIST_PATH}: {e}")
        return [], set()

    if not isinstance(data, list):
        print(f"Warning: {SCOUT_SUGGESTED_LIST_PATH} should be a JSON array of objects")
        return [], set()

    entries = []
    repos = set()
    for item in data:
        if not isinstance(item, dict) or not item.get('url'):
            continue
        url = (item.get('url') or '').strip()
        entries.append({
            "url": url,
            "name": item.get("name", url),
            "date": item.get("date", ""),
            "notes": item.get("notes", ""),
        })
        repo = extract_github_repo(url)
        if repo:
            repos.add(repo)

    return entries, repos


def save_scout_suggested_list(existing_entries, new_entries):
    """Merge new scout suggestions into data/scout_suggested.json by URL."""
    seen = {(entry.get("url") or "").strip().lower() for entry in existing_entries}
    merged = list(existing_entries)
    for entry in new_entries:
        url = (entry.get("url") or "").strip()
        if url and url.lower() not in seen:
            merged.append({
                "url": url,
                "name": entry.get("name", url),
                "date": entry.get("date", ""),
                "notes": entry.get("notes", ""),
            })
            seen.add(url.lower())

    try:
        with open(SCOUT_SUGGESTED_LIST_PATH, 'w', encoding='utf-8') as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
            f.write('\n')
    except IOError as e:
        print(f"Warning: Failed to write {SCOUT_SUGGESTED_LIST_PATH}: {e}")


def main():
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        print("Error: No token")
        return 1

    print("Starting scout...")

    collection_repos = load_collection_repos()
    suggested_entries, suggested_repos = load_scout_suggested_list()
    known = collection_repos | suggested_repos

    print(f"Loaded {len(collection_repos)} repositories from collection")
    print(f"Loaded {len(suggested_repos)} previously suggested repositories")

    gh = Github(token)
    found = []
    skipped_collection = 0
    skipped_suggested = 0

    queries = ["intentionally vulnerable", "deliberately vulnerable web"]
    for query in queries:
        print(f"Searching: {query}")
        try:
            search_query = f"{query} stars:>=10 fork:false archived:false"
            results = gh.search_repositories(query=search_query, sort='stars', order='desc')

            for repo in list(results)[:5]:
                repo_key = repo.full_name.lower()
                if repo_key in collection_repos:
                    print(f"  Skipping {repo.name} (already in collection)")
                    skipped_collection += 1
                    continue
                if repo_key in known:
                    print(f"  Skipping {repo.name} (previously suggested)")
                    skipped_suggested += 1
                    continue

                found.append({
                    'name': repo.name,
                    'url': repo.html_url,
                    'stars': repo.stargazers_count,
                    'description': repo.description or 'No description',
                    'language': repo.language or 'Unknown',
                    'full_name': repo.full_name
                })
                known.add(repo_key)
                print(f"  Found: {repo.name} ({repo.stargazers_count} stars)")
        except Exception as e:
            print(f"Error searching '{query}': {e}")

    if len(found) == 0:
        print("Done!")
        print(f"  New repos found: {len(found)}")
        print(f"  Skipped (in collection): {skipped_collection}")
        print(f"  Skipped (previously suggested): {skipped_suggested}")
        print("  No issue will be created (no new apps found)")
        return 0

    date = datetime.now().strftime('%Y-%m-%d')
    save_scout_suggested_list(
        suggested_entries,
        [{"url": r['url'], "name": r['name'], "date": date, "notes": ""} for r in found],
    )

    with open('scout-results.json', 'w', encoding='utf-8') as f:
        json.dump({
            'scan_date': date,
            'total_found': len(found),
            'skipped_collection': skipped_collection,
            'skipped_suggested': skipped_suggested,
            'repositories': found
        }, f, indent=2)

    body = "<details>\n"
    body += "<summary>### Summary</summary>\n\n"
    body += f"- New repositories found: {len(found)}\n"
    body += f"- Already in collection (skipped): {skipped_collection}\n"
    body += f"- Previously suggested (skipped): {skipped_suggested}\n\n"
    body += "</details>\n\n"
    body += "---\n\n"

    body += "### 🆕 New Repositories\n\n"
    for i, r in enumerate(found, 1):
        body += f"#### {i}. [{r['name']}]({r['url']})\n\n"
        body += f"- **Repository:** `{r['full_name']}`\n"
        body += f"- **Stars:** ⭐ {r['stars']}\n"
        body += f"- **Language:** {r['language']}\n"
        body += f"- **Description:** {r['description']}\n\n"
        body += "<details>\n"
        body += "<summary>📋 Suggested collection.json entry</summary>\n\n"
        body += "```json\n"
        body += json.dumps({
            "url": r['url'],
            "name": r['name'],
            "description": r['description'],
            "language": r['language'],
            "technologies": [],
            "collection": ["offline"]
        }, indent=2)
        body += "\n```\n\n"
        body += "</details>\n\n"
        if i < len(found):
            body += "---\n\n"

    with open('scout-issue-body.md', 'w', encoding='utf-8') as f:
        f.write(body)

    print("\nDone!")
    print(f"  New repos found: {len(found)}")
    print(f"  Skipped (in collection): {skipped_collection}")
    print(f"  Skipped (previously suggested): {skipped_suggested}")
    return 0


if __name__ == '__main__':
    exit(main())
