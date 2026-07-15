"""골드셋 평가 하네스 — 라벨된 계약 케이스로 유형감지·부재알람을 회귀 채점.

케이스: tests/goldset/cases/*.yaml
  id, desc, text(계약 본문), detect_expected(기대 유형),
  consider_must_include[](누락검출이 살아야 할 check id),
  consider_must_exclude[](오탐이면 안 되는 check id),
  consider_must_exclude_prefix[](오탐 금지 id 접두어 — 모듈 계열 단위).

실행: python3 build/goldset.py  (전 케이스 통과 시 exit 0)
pytest 게이트: tests/test_goldset.py 가 동일 채점을 회귀로 강제.
지금까지의 실사용 오탐(§60·화해·질권)이 케이스 01~05로 고정되어 있다 —
새 오탐이 발견되면 케이스를 추가하는 것이 이 하네스의 성장 방식이다.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent))
from validate import load_knowledge  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CASES_DIR = ROOT / "tests" / "goldset" / "cases"
RUNNER = ROOT / "build" / "goldset_runner.js"


def load_cases():
    cases = [yaml.safe_load(p.read_text()) for p in sorted(CASES_DIR.glob("*.yaml"))]
    if not cases:
        raise RuntimeError(f"골드셋 케이스가 없음: {CASES_DIR}")
    return cases


def run_goldset(knowledge_dir=None):
    """지식 로드 → node 러너(앱 파이프라인 재현) → 채점 리포트 반환."""
    k = load_knowledge(knowledge_dir or ROOT / "knowledge")
    cases = load_cases()
    payload = {"common": k["common"], "types": k["types"], "cases": cases}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(payload, f, ensure_ascii=False)
        path = f.name
    out = subprocess.run(["node", str(RUNNER), path], capture_output=True, text=True, cwd=ROOT)
    Path(path).unlink(missing_ok=True)
    if out.returncode != 0:
        raise RuntimeError(f"goldset_runner 실패: {out.stderr}")
    return score(cases, json.loads(out.stdout))


def score(cases, results):
    rows, ok_all = [], True
    for c, r in zip(cases, results):
        errs = []
        # detect_expected: null(미확정 기대)도 유효한 라벨 — 키 존재로 판정.
        if "detect_expected" in c and r["detected"] != c["detect_expected"]:
            errs.append(f"유형감지: 기대 {c['detect_expected']} ≠ 실제 {r['detected']}")
        active = set(r.get("activeModules") or [])
        for mid in c.get("active_must_include") or []:
            if mid not in active:
                errs.append(f"모듈 미활성: {mid}가 activeModules에 없음")
        for mid in c.get("active_must_exclude") or []:
            if mid in active:
                errs.append(f"모듈 오활성: {mid}가 activeModules에 있음")
        addressed = set(r.get("addressed") or [])
        for cid in c.get("addressed_must_exclude") or []:
            if cid in addressed:
                errs.append(f"부착 오탐: {cid}가 addressed로 붙음(weak-role 게이트 위반)")
        consider = set(r["consider"])
        for cid in c.get("consider_must_include") or []:
            if cid not in consider:
                errs.append(f"누락검출 실패: {cid}가 consider에 없음")
        for cid in c.get("consider_must_exclude") or []:
            if cid in consider:
                errs.append(f"오탐: {cid} 부재알람 발동")
        for pre in c.get("consider_must_exclude_prefix") or []:
            hits = sorted(x for x in consider if x.startswith(pre))
            if hits:
                errs.append(f"오탐: {pre}* 부재알람 {hits}")
        rows.append({
            "id": c["id"], "desc": c.get("desc", ""), "ok": not errs, "errors": errs,
            "detected": r["detected"], "consider_n": len(consider),
        })
        ok_all = ok_all and not errs
    return {"ok": ok_all, "rows": rows}


def main():
    rep = run_goldset()
    for row in rep["rows"]:
        mark = "✓" if row["ok"] else "✗"
        print(f"{mark} {row['id']} — {row['desc']} (감지 {row['detected']}, consider {row['consider_n']}건)")
        for e in row["errors"]:
            print(f"    - {e}")
    n_ok = sum(1 for r in rep["rows"] if r["ok"])
    print(f"골드셋: {n_ok}/{len(rep['rows'])} 통과")
    sys.exit(0 if rep["ok"] else 1)


if __name__ == "__main__":
    main()
