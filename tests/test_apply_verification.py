import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "build"))
import apply_verification as av

COMMON_YAML = """\
meta:
  type_id: common
  type_name: 공통
  detect_keywords: []
  modules: []
checks:
  - id: CMN-12
    check: 손해배상 범위 조항이 있는가
    severity: 참고
    norm_type: 임의
    basis: statute
    severity_basis: 임의규정임
    triggers:
      keywords: [손해배상]
    absence_check: true
    sources:
      - law: 민법
        article: 제393조
        quote: 통상의 손해를 그 한도로 한다
        verified: false
      - law: 민법
        article: 제394조
        verified: false
  - id: CMN-99
    check: 실무 항목
    severity: 참고
    norm_type: 실무
    basis: practice
    severity_basis: 실무
    triggers:
      keywords: [x]
    absence_check: false
    sources: []
"""


def _kdir(tmp_path):
    (tmp_path / "types").mkdir()
    (tmp_path / "common.yaml").write_text(COMMON_YAML)
    return tmp_path


def test_confirm_flips_verified(tmp_path):
    kdir = _kdir(tmp_path)
    dec = tmp_path / "v.json"
    dec.write_text(json.dumps({"CMN-12#0": {"decision": "확인", "date": "2026-07-09"}}))
    res = av.apply(dec, kdir=kdir, log_path=tmp_path / "log.json")
    text = (kdir / "common.yaml").read_text()
    # 첫 source만 true, 둘째는 false 유지
    lines = [l for l in text.splitlines() if "verified:" in l]
    assert lines[0].strip() == "verified: true"
    assert lines[1].strip() == "verified: false"
    assert res["applied"] == 1


def test_needsfix_not_applied_and_reported(tmp_path):
    kdir = _kdir(tmp_path)
    dec = tmp_path / "v.json"
    dec.write_text(json.dumps({"CMN-12#1": {"decision": "수정필요", "note": "조 재확인"}}))
    res = av.apply(dec, kdir=kdir, log_path=tmp_path / "log.json")
    text = (kdir / "common.yaml").read_text()
    assert "verified: true" not in text  # 미반영
    assert res["needsfix"] == [("CMN-12", "조 재확인")]


def test_idempotent(tmp_path):
    kdir = _kdir(tmp_path)
    dec = tmp_path / "v.json"
    dec.write_text(json.dumps({"CMN-12#0": {"decision": "확인"}}))
    av.apply(dec, kdir=kdir, log_path=tmp_path / "log.json")
    first = (kdir / "common.yaml").read_text()
    av.apply(dec, kdir=kdir, log_path=tmp_path / "log.json")
    assert (kdir / "common.yaml").read_text() == first  # 재적용해도 동일


def test_unknown_key_skipped(tmp_path):
    kdir = _kdir(tmp_path)
    dec = tmp_path / "v.json"
    dec.write_text(json.dumps({"NOPE-1#0": {"decision": "확인"}, "CMN-12#5": {"decision": "확인"}}))
    res = av.apply(dec, kdir=kdir, log_path=tmp_path / "log.json")
    assert res["applied"] == 0
    assert set(res["missing"]) == {"NOPE-1#0", "CMN-12#5"}


def test_log_written(tmp_path):
    kdir = _kdir(tmp_path)
    dec = tmp_path / "v.json"
    dec.write_text(json.dumps({"CMN-12#0": {"decision": "확인", "date": "2026-07-09"}}))
    logp = tmp_path / "log.json"
    av.apply(dec, kdir=kdir, log_path=logp)
    log = json.loads(logp.read_text())
    assert log["CMN-12#0"]["decision"] == "확인"


def test_result_valid_yaml(tmp_path):
    # 패치 후 load_knowledge가 여전히 유효하게 파싱되는지
    kdir = _kdir(tmp_path)
    dec = tmp_path / "v.json"
    dec.write_text(json.dumps({"CMN-12#0": {"decision": "확인"}}))
    av.apply(dec, kdir=kdir, log_path=tmp_path / "log.json")
    from validate import load_knowledge
    k = load_knowledge(kdir)
    assert k["common"]["checks"][0]["sources"][0]["verified"] is True
