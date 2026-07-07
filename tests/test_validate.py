import pytest
from validate import load_knowledge, ValidationError


def test_load_valid(knowledge_dir):
    k = load_knowledge(knowledge_dir)
    assert k["common"]["meta"]["type_id"] == "common"
    assert len(k["types"]) == 1
    assert k["types"][0]["checks"][0]["id"] == "OUT-01"


def test_checkpoints_key_rejected(knowledge_dir):
    bad = (knowledge_dir / "common.yaml").read_text().replace("checks:", "checkpoints:", 1)
    (knowledge_dir / "common.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="checkpoints"):
        load_knowledge(knowledge_dir)


def test_guidance_field_rejected(knowledge_dir):
    bad = (knowledge_dir / "common.yaml").read_text().replace(
        "    sources: []\n", "    sources: []\n    guidance: 폐지된 필드임\n"
    )
    (knowledge_dir / "common.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="guidance"):
        load_knowledge(knowledge_dir)


def test_statute_missing_quote_rejected(knowledge_dir):
    bad = (knowledge_dir / "types" / "outsourcing.yaml").read_text().replace(
        "        quote: 사전 동의를 받아야 한다\n", ""
    )
    (knowledge_dir / "types" / "outsourcing.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="quote"):
        load_knowledge(knowledge_dir)


def test_bad_norm_type_rejected(knowledge_dir):
    bad = (knowledge_dir / "common.yaml").read_text().replace("norm_type: 실무", "norm_type: 없음")
    (knowledge_dir / "common.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="norm_type"):
        load_knowledge(knowledge_dir)


def test_practice_empty_sources_allowed(knowledge_dir):
    k = load_knowledge(knowledge_dir)
    cmn01 = k["common"]["checks"][0]
    assert cmn01["basis"] == "practice"
    assert cmn01["sources"] == []


def test_duplicate_id_rejected(knowledge_dir):
    dup = (knowledge_dir / "types" / "outsourcing.yaml").read_text().replace("OUT-01", "CMN-01")
    (knowledge_dir / "types" / "outsourcing.yaml").write_text(dup)
    with pytest.raises(ValidationError, match="중복"):
        load_knowledge(knowledge_dir)


def test_bad_severity_rejected(knowledge_dir):
    bad = (knowledge_dir / "common.yaml").read_text().replace("severity: 필수", "severity: 심각")
    (knowledge_dir / "common.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="severity"):
        load_knowledge(knowledge_dir)


def test_unknown_module_rejected(knowledge_dir):
    bad = (knowledge_dir / "types" / "outsourcing.yaml").read_text().replace("module: M-PRIV", "module: M-NOPE")
    (knowledge_dir / "types" / "outsourcing.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="module"):
        load_knowledge(knowledge_dir)


def test_missing_required_field_rejected(knowledge_dir):
    bad = (knowledge_dir / "common.yaml").read_text().replace("    severity: 필수\n", "", 1)
    (knowledge_dir / "common.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="필수 필드"):
        load_knowledge(knowledge_dir)


def test_source_missing_verified_rejected(knowledge_dir):
    bad = (knowledge_dir / "types" / "outsourcing.yaml").read_text().replace("        verified: true\n", "")
    (knowledge_dir / "types" / "outsourcing.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="sources"):
        load_knowledge(knowledge_dir)


def test_empty_meta_rejected(knowledge_dir):
    (knowledge_dir / "common.yaml").write_text("meta:\nchecks: []\n")
    with pytest.raises(ValidationError, match="meta"):
        load_knowledge(knowledge_dir)


def test_null_checks_rejected(knowledge_dir):
    text = (knowledge_dir / "common.yaml").read_text()
    bad = text.split("checks:")[0] + "checks:\n"
    (knowledge_dir / "common.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="checks"):
        load_knowledge(knowledge_dir)


def test_missing_common_yaml_rejected(knowledge_dir):
    (knowledge_dir / "common.yaml").unlink()
    with pytest.raises(ValidationError, match="찾을 수 없음"):
        load_knowledge(knowledge_dir)


def test_bad_trigger_pattern_rejected(knowledge_dir):
    bad = (knowledge_dir / "common.yaml").read_text().replace(
        "      keywords: [손해배상, 배상]\n",
        "      keywords: [손해배상, 배상]\n      patterns: [\"(\"]\n",
    )
    (knowledge_dir / "common.yaml").write_text(bad)
    with pytest.raises(ValidationError, match="patterns"):
        load_knowledge(knowledge_dir)
