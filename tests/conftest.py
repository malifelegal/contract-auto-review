import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "build"))

import pytest

VALID_COMMON = """\
meta:
  type_id: common
  type_name: 공통
  detect_keywords: []
  modules: []
checkpoints:
  - id: CMN-01
    title: 손해배상
    severity: 필수
    triggers:
      keywords: [손해배상, 배상]
    absence_check: true
    guidance: 손해배상 조항의 상한·범위를 확인해야 함
    legal_basis: []
"""

VALID_TYPE = """\
meta:
  type_id: outsourcing
  type_name: 업무위탁
  detect_keywords: [위탁, 수탁]
  modules:
    - id: M-PRIV
      name: 개인정보 처리위탁
      always_on: false
      screening_question: 개인정보 처리가 포함되는가?
      suggest_keywords: [개인정보]
checkpoints:
  - id: OUT-01
    title: 재위탁 제한
    severity: 필수
    module: M-PRIV
    triggers:
      keywords: [재위탁]
    absence_check: true
    guidance: 재위탁 시 사전 동의 요건을 명시해야 함
    legal_basis:
      - law: 테스트법
        article: 제3조
        verified: true
"""


@pytest.fixture
def knowledge_dir(tmp_path):
    (tmp_path / "types").mkdir()
    (tmp_path / "common.yaml").write_text(VALID_COMMON)
    (tmp_path / "types" / "outsourcing.yaml").write_text(VALID_TYPE)
    return tmp_path
