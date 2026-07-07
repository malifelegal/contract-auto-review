"""지식 YAML 로드 및 스키마 검증. knowledge/schema.md가 규격 문서임."""
import re
from pathlib import Path

import yaml

SEVERITIES = {"필수", "권장", "참고"}
NORM_TYPES = {"강행", "임의", "추정", "간주", "실무"}
BASES = {"statute", "practice"}
REQUIRED_FIELDS = {"id", "check", "severity", "basis", "norm_type"}
SOURCE_REQUIRED_FIELDS = {"law", "article", "verified"}


class ValidationError(Exception):
    pass


def load_knowledge(knowledge_dir):
    """common.yaml + types/*.yaml 로드·검증 → {"common": dict, "types": [dict]}"""
    kdir = Path(knowledge_dir)
    common = _load_file(kdir / "common.yaml")
    types = [_load_file(p) for p in sorted((kdir / "types").glob("*.yaml"))]
    _validate(common, types)
    return {"common": common, "types": types}


def _load_file(path):
    if not path.is_file():
        raise ValidationError(f"{path.name}: 파일을 찾을 수 없음")
    data = yaml.safe_load(path.read_text())
    if not isinstance(data, dict):
        raise ValidationError(f"{path.name}: 최상위에 meta·checks 키가 필요함")
    if not isinstance(data.get("meta"), dict):
        raise ValidationError(f"{path.name}: meta는 비어 있지 않은 매핑이어야 함")
    if "checkpoints" in data:
        raise ValidationError(f"{path.name}: checkpoints는 v2에서 checks로 변경됨")
    if not isinstance(data.get("checks"), list):
        raise ValidationError(f"{path.name}: checks는 리스트여야 함")
    data["meta"].setdefault("modules", [])
    data["meta"].setdefault("detect_keywords", [])
    return data


def _validate(common, types):
    seen_ids = set()
    for doc in [common, *types]:
        fname = doc["meta"].get("type_id", "?")
        module_ids = {m["id"] for m in doc["meta"]["modules"]}
        for cp in doc["checks"]:
            cid = cp.get("id", "?")
            if "guidance" in cp:
                raise ValidationError(f"{cid}: guidance는 폐지됨 — note 사용")
            missing = REQUIRED_FIELDS - cp.keys()
            if missing:
                raise ValidationError(f"{fname}/{cid}: 필수 필드 누락 {sorted(missing)}")
            if cp["id"] in seen_ids:
                raise ValidationError(f"중복 id: {cp['id']}")
            seen_ids.add(cp["id"])
            if cp["severity"] not in SEVERITIES:
                raise ValidationError(f"{cid}: severity 값 오류 '{cp['severity']}'")
            if cp["norm_type"] not in NORM_TYPES:
                raise ValidationError(f"{cid}: norm_type 값 오류 '{cp['norm_type']}'")
            if cp["basis"] not in BASES:
                raise ValidationError(f"{cid}: basis 값 오류 '{cp['basis']}'")
            if "module" in cp and cp["module"] not in module_ids:
                raise ValidationError(f"{cid}: 선언되지 않은 module '{cp['module']}'")

            sources = cp.get("sources", [])
            if not isinstance(sources, list):
                raise ValidationError(f"{cid}: sources는 리스트여야 함")
            for src in sources:
                missing_src = SOURCE_REQUIRED_FIELDS - src.keys()
                if missing_src:
                    raise ValidationError(f"{cid}: sources 항목에 {sorted(missing_src)} 필요")

            if cp["basis"] == "statute":
                if not sources:
                    raise ValidationError(f"{cid}: basis=statute는 sources가 1개 이상 필요함")
                quote = sources[0].get("quote")
                if not isinstance(quote, str) or not quote.strip():
                    raise ValidationError(f"{cid}: basis=statute는 sources[0].quote가 필요함")

            note = cp.get("note")
            if note is not None and not isinstance(note, str):
                raise ValidationError(f"{cid}: note는 문자열이어야 함")

            # Python re로 컴파일 검증 — JS RegExp과 문법이 미세하게 다르나 현재 패턴 수준(\s* 등)에선 동일함
            for p in (cp.get("triggers") or {}).get("patterns", []):
                try:
                    re.compile(p)
                except re.error:
                    raise ValidationError(f"{cid}: triggers.patterns 정규식 오류 '{p}'")
