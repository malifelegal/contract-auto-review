import sqlite3

import pytest
import yaml

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "build"))

from extract_candidates import build_candidates, is_enumerated, split_items, render_yaml

ENUM_TEXT = (
    "제6조(업무위탁에 따른 개인정보의 처리 제한) 개인정보처리자가 제3자에게 개인정보의 "
    "처리 업무를 위탁하는 경우에는 다음 각 호의 내용이 포함된 문서로 하여야 한다. "
    "<개정 2023.3.14> "
    "1. 위탁업무 수행 목적 외 개인정보의 처리 금지에 관한 사항 "
    "2. 개인정보의 기술적ㆍ관리적 보호조치에 관한 사항 "
    "3. 그 밖에 개인정보의 안전한 관리를 위하여 대통령령으로 정한 사항 "
    "② 제1항에 따라 개인정보의 처리 업무를 위탁하는 개인정보처리자는 공개하여야 한다."
)

NON_ENUM_TEXT = "제5조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다. 위탁이란 업무를 맡기는 것을 말한다."

# 전자금융감독규정 스타일: 개정 주석 날짜에 내부 공백이 있음(<개정 2022. 12. 21.>)
# — "12. "·"21.>"가 호 경계로 오인되면 안 됨
SPACED_DATE_TEXT = (
    "제7조(안전대책) 금융회사는 다음 각 호의 사항을 포함한 안전대책을 수립"
    "하여야 한다. <개정 2022. 12. 21.> "
    "1. 첫째 호 "
    "2. 둘째 호 <신설 2023. 3. 14.> "
    "3. <별표 2의2>의 평가항목에 따른 셋째 호 <단서신설 2018. 12. 21> "
    "② 이동된 항임 <종전의 제7항에서 이동, 2025. 2. 5.>"
)

# 호 문언 중간에 개정 주석이 공백 없이 붙은 경우(전자금융감독규정 14조의2 1호 실측 패턴)
# — quote가 원문 부분문자열이어야 하므로 중간 주석은 제거하지 않고 그대로 담아야 함
INNER_NOTE_TEXT = (
    "제8조(내부주석) 회사는 다음 각 호의 사항을 포함하여야 한다. "
    "1. 다음 각 목의 평가<개정 2022. 11. 23.> 가. 특성 나. 영향 "
    "2. 둘째 호"
)


@pytest.fixture
def law_db(tmp_path):
    path = tmp_path / "laws.sqlite"
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE law_articles (id INTEGER PRIMARY KEY, law_name TEXT, "
        "article_ref TEXT, text TEXT, mst TEXT, source TEXT, updated_at TEXT)"
    )
    conn.execute(
        "INSERT INTO law_articles (law_name, article_ref, text) VALUES (?, ?, ?)",
        ("테스트법", "제5조", NON_ENUM_TEXT),
    )
    conn.execute(
        "INSERT INTO law_articles (law_name, article_ref, text) VALUES (?, ?, ?)",
        ("테스트법", "제6조", ENUM_TEXT),
    )
    conn.execute(
        "INSERT INTO law_articles (law_name, article_ref, text) VALUES (?, ?, ?)",
        ("테스트법", "제7조", SPACED_DATE_TEXT),
    )
    conn.execute(
        "INSERT INTO law_articles (law_name, article_ref, text) VALUES (?, ?, ?)",
        ("테스트법", "제8조", INNER_NOTE_TEXT),
    )
    conn.commit()
    conn.close()
    return path


def test_enumerated_article_splits_into_items_by_ho_boundary(law_db):
    candidates = build_candidates("테스트법", "제6조", [law_db])
    assert len(candidates) == 3
    quotes = [c["sources"][0]["quote"] for c in candidates]
    assert quotes[0] == "위탁업무 수행 목적 외 개인정보의 처리 금지에 관한 사항"
    assert quotes[1] == "개인정보의 기술적ㆍ관리적 보호조치에 관한 사항"
    # 마지막 호는 다음 항(② ...) 앞에서 잘려야 함 — 항 텍스트가 섞여 들어가면 안 됨
    assert quotes[2] == "그 밖에 개인정보의 안전한 관리를 위하여 대통령령으로 정한 사항"
    for q in quotes:
        assert q in ENUM_TEXT
    ids = [c["id"] for c in candidates]
    assert ids == ["CAND-1", "CAND-2", "CAND-3"]
    for c in candidates:
        assert c["norm_type"] == "강행"
        assert c["basis"] == "statute"
        assert c["severity"] == "필수"
        assert c["absence_check"] is True
        assert c["sources"][0]["article"] == "제6조"
        assert c["sources"][0]["verified"] is False


def test_non_enumerated_article_is_skipped(law_db):
    assert not is_enumerated(NON_ENUM_TEXT)
    candidates = build_candidates("테스트법", "제5조", [law_db])
    assert candidates == []


def test_build_candidates_whole_law_only_keeps_enumerated_articles(law_db):
    candidates = build_candidates("테스트법", None, [law_db])
    articles = {c["sources"][0]["article"] for c in candidates}
    assert articles == {"제6조", "제7조", "제8조"}  # 비열거형 제5조 제외
    assert len(candidates) == 8


def test_split_items_returns_empty_for_non_enumerated_text():
    assert split_items(NON_ENUM_TEXT) == []


def test_spaced_amendment_dates_are_not_ho_boundaries(law_db):
    """<개정 2022. 12. 21.>처럼 날짜에 내부 공백이 있어도 호 경계로 오인하지 않는다.
    <단서신설 2018. 12. 21>(마침표 없음)·<종전의 제N항에서 이동, ...> 변형도 제거하되,
    <별표 2의2> 같은 실질 내용 꺾쇠 참조는 보존한다."""
    candidates = build_candidates("테스트법", "제7조", [law_db])
    assert len(candidates) == 3
    quotes = [c["sources"][0]["quote"] for c in candidates]
    assert quotes[0] == "첫째 호"
    assert quotes[1] == "둘째 호"
    assert quotes[2] == "<별표 2의2>의 평가항목에 따른 셋째 호"
    for q in quotes:
        assert "<개정" not in q
        assert "<신설" not in q
        assert "<단서신설" not in q
        assert "<종전의" not in q
        assert "21.>" not in q
        assert "21>" not in q


def test_inner_annotation_kept_so_quote_stays_raw_substring(law_db):
    """호 중간에 낀 개정 주석은 제거하면 quote가 원문 부분문자열이 아니게 되므로
    보존한다 (경계 탐지에만 주석 제거본 사용). 호 경계 오분할은 없어야 함."""
    candidates = build_candidates("테스트법", "제8조", [law_db])
    assert len(candidates) == 2
    quotes = [c["sources"][0]["quote"] for c in candidates]
    assert quotes[0] == "다음 각 목의 평가<개정 2022. 11. 23.> 가. 특성 나. 영향"
    assert quotes[1] == "둘째 호"
    for q in quotes:
        assert q in INNER_NOTE_TEXT  # 원문 부분문자열 불변식


def test_output_yaml_is_loadable_and_quote_is_substring(law_db):
    candidates = build_candidates("테스트법", "제6조", [law_db])
    text = render_yaml(candidates)
    loaded = yaml.safe_load(text)
    assert "checks" in loaded
    assert len(loaded["checks"]) == 3
    for check in loaded["checks"]:
        quote = check["sources"][0]["quote"]
        assert quote in ENUM_TEXT
        assert check["check"].endswith("— 질문형 정제 필요")
