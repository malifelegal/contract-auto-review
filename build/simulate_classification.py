"""Phase D — 실계약명 전량 분류 시뮬레이션.

계약검토내역(efefe.xlsx 추출 JSONL)의 계약명 6,631건에 앱과 동일한
detectType·pickType(제목 가중·본문 캡·임계 미확정)을 돌려 분류 커버리지를 측정.

주의: 계약명만으로의 감지라 본문 감지보다 보수적(하한 지표). 계약명이 곧
표제부이므로 DETECT_TITLE_W 가중이 그대로 적용된다.

실행: python3 build/simulate_classification.py [--jsonl PATH] [--csv OUT]
출력: 유형 분포·미분류율·기존 중분류 크로스탭(stdout), 상세 CSV(선택).
"""
import argparse
import json
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from validate import load_knowledge  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSONL = Path(
    "/private/tmp/claude-501/-Users-nsss-obsidian-nss/038e2719-7de5-443b-a7c8-ca944bb35573/scratchpad/reclass/contracts.jsonl"
)

RUNNER = r"""
const fs = require("fs");
const { detectType, pickType } = require(process.argv[3] + "/src/matcher.js");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { types, names } = payload;
const out = names.map(function (name) {
  const ranked = detectType(name, types);
  const picked = pickType(ranked);
  return { picked: picked, top: ranked[0] ? ranked[0].typeId : null, score: ranked[0] ? ranked[0].score : 0 };
});
process.stdout.write(JSON.stringify(out));
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jsonl", default=str(DEFAULT_JSONL))
    ap.add_argument("--csv", default="")
    args = ap.parse_args()

    rows = [json.loads(l) for l in Path(args.jsonl).read_text().splitlines() if l.strip()]
    k = load_knowledge(ROOT / "knowledge")
    types = [{"meta": t["meta"]} for t in k["types"]]

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump({"types": types, "names": [r["name"] for r in rows]}, f, ensure_ascii=False)
        payload_path = f.name
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(RUNNER)
        runner_path = f.name
    out = subprocess.run(["node", runner_path, payload_path, str(ROOT)], capture_output=True, text=True)
    Path(payload_path).unlink(missing_ok=True)
    Path(runner_path).unlink(missing_ok=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    results = json.loads(out.stdout)

    n = len(rows)
    dist = Counter(r["picked"] or "(미확정)" for r in results)
    print(f"# 분류 시뮬레이션 — {n}건 (계약명 기반 하한 지표)\n")
    print("## 새 유형 분포")
    for k2, v in dist.most_common():
        print(f"- {k2}: {v} ({v/n*100:.1f}%)")

    # 기존 중분류 → 새 유형 크로스탭 (상위 중분류만)
    cross = Counter()
    for r, res in zip(rows, results):
        cross[(r.get("t1") or "(없음)", res["picked"] or "(미확정)")] += 1
    print("\n## 기존 중분류 → 새 유형 (상위 30 셀)")
    for (t1, nt), v in cross.most_common(30):
        print(f"- {t1} → {nt}: {v}")

    if args.csv:
        import csv
        with open(args.csv, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["t1", "t2", "name", "picked", "top", "score"])
            for r, res in zip(rows, results):
                w.writerow([r.get("t1"), r.get("t2"), r["name"], res["picked"], res["top"], res["score"]])
        print(f"\n상세 CSV: {args.csv}")


if __name__ == "__main__":
    main()
