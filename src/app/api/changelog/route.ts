import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

interface ChangelogCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export async function GET() {
  try {
    const repoRoot = path.resolve(process.cwd());
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--pretty=format:%H|%s|%an|%aI", "--max-count=200"],
      { cwd: repoRoot, timeout: 10_000 },
    );

    const commits: ChangelogCommit[] = [];
    for (const line of stdout.trim().split("\n")) {
      if (!line.includes("|")) continue;
      const parts = line.split("|");
      if (parts.length < 4) continue;
      const [hash, message, author, ...rest] = parts;
      commits.push({
        hash: hash.slice(0, 7),
        message,
        author,
        date: rest.join("|"),
      });
    }

    const groups = new Map<string, ChangelogCommit[]>();
    for (const c of commits) {
      const day = c.date.slice(0, 10);
      const list = groups.get(day) ?? [];
      list.push(c);
      groups.set(day, list);
    }

    const entries = Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, dayCommits]) => ({ date: day, commits: dayCommits }));

    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json({
      entries: [],
      error: err instanceof Error ? err.message : "Git log failed",
    });
  }
}
