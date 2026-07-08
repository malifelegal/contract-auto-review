"""검수 판정 JSON(verification.json) → 지식 YAML verified:true 승격.

사용: python3 build/apply_verification.py verification.json
- "확인" source: 해당 check의 sources[index]의 `verified: false` 라인을 `true`로 타겟 패치(포맷·주석 보존).
- "수정필요": YAML 미변경, 콘솔에 큐레이터 수정 목록 출력.
- 감사 로그: data/verification_log.json 병합.
- 멱등: 이미 true면 무변경. 존재하지 않는 key는 경고 후 스킵.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
KDIR_DEFAULT = ROOT / "knowledge"
LOG_DEFAULT = ROOT / "data" / "verification_log.json"

_ID_RE = re.compile(r"^\s*-?\s*id:\s*(\S+)\s*$")
_VER_RE = re.compile(r"^(\s*)verified:\s*(false|true)\s*$")


def _files(kdir):
    return [kdir / "common.yaml"] + sorted((kdir / "types").glob("*.yaml"))


def _flip_file(path, confirm):
    """confirm: set of (check_id, source_index). 반환: 적용된 (check_id, index) set."""
    lines = path.read_text().splitlines(keepends=True)
    out, applied = [], set()
    cur, src_i = None, -1
    for ln in lines:
        m = _ID_RE.match(ln)
        if m:
            cur, src_i = m.group(1), -1
        vm = _VER_RE.match(ln)
        if vm and cur is not None:
            src_i += 1
            if (cur, src_i) in confirm:
                ln = vm.group(1) + "verified: true\n"
                applied.add((cur, src_i))
        out.append(ln)
    new = "".join(out)
    if new != path.read_text():
        path.write_text(new)
    return applied


def apply(json_path, kdir=KDIR_DEFAULT, log_path=LOG_DEFAULT):
    kdir = Path(kdir)
    decisions = json.loads(Path(json_path).read_text())
    confirm, needsfix = set(), []
    for key, v in decisions.items():
        cid, _, idx = key.rpartition("#")
        dec = (v or {}).get("decision")
        if dec == "확인":
            confirm.add((cid, int(idx)))
        elif dec == "수정필요":
            needsfix.append((cid, (v or {}).get("note", "")))
    applied = set()
    for f in _files(kdir):
        applied |= _flip_file(f, confirm)
    missing = sorted(
        "{}#{}".format(c, i) for (c, i) in confirm if (c, i) not in applied
    )
    # 감사 로그 병합
    log = {}
    log_path = Path(log_path)
    if log_path.exists():
        try:
            log = json.loads(log_path.read_text())
        except Exception:
            log = {}
    for key, v in decisions.items():
        if (v or {}).get("decision") in ("확인", "수정필요"):
            log[key] = v
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2))

    print("적용(verified:true): {}건".format(len(applied)))
    if needsfix:
        print("수정 필요(큐레이터 확인):")
        for cid, note in needsfix:
            print("  - {}: {}".format(cid, note))
    if missing:
        print("경고 — 존재하지 않는 key 스킵: {}".format(", ".join(missing)))
    print("재빌드하려면: python3 build/build_html.py")
    return {"applied": len(applied), "needsfix": needsfix, "missing": missing}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용: python3 build/apply_verification.py verification.json")
        sys.exit(1)
    apply(sys.argv[1])
