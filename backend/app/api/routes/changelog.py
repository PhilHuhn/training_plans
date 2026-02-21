import subprocess
from collections import defaultdict
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/changelog", tags=["changelog"])


@router.get("")
async def get_changelog():
    """Return changelog data grouped by date from git log."""
    try:
        # Find the git repo root
        repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent

        result = subprocess.run(
            ["git", "log", "--pretty=format:%H|%s|%an|%aI", "--max-count=200"],
            capture_output=True,
            text=True,
            cwd=str(repo_root),
            timeout=10,
        )

        if result.returncode != 0:
            return {"entries": [], "error": "Git log failed"}

        commits = []
        for line in result.stdout.strip().split("\n"):
            if "|" in line:
                parts = line.split("|", 3)
                if len(parts) >= 4:
                    commits.append(
                        {
                            "hash": parts[0][:7],
                            "message": parts[1],
                            "author": parts[2],
                            "date": parts[3],
                        }
                    )

        # Group by date
        groups: dict[str, list] = defaultdict(list)
        for c in commits:
            day = c["date"][:10]
            groups[day].append(c)

        entries = [
            {"date": day, "commits": day_commits}
            for day, day_commits in sorted(groups.items(), reverse=True)
        ]

        return {"entries": entries}

    except Exception as e:
        return {"entries": [], "error": str(e)}
