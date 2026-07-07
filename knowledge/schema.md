# 지식 YAML 스키마

## 파일 구성
- `common.yaml` — 모든 계약 공통 체크리스트
- `types/<type_id>.yaml` — 유형별 체크리스트

## 최상위 구조 (두 키 모두 필수)

meta:
  type_id: outsourcing        # 파일명과 일치. common.yaml은 "common"
  type_name: 업무위탁          # UI 표시명
  detect_keywords: [위탁, 수탁]  # 유형 자동 감지용 (common은 빈 리스트)
  modules:                    # 규제 레짐 모듈. 없으면 빈 리스트
    - id: M-PRIV              # 파일 내 유일
      name: 개인(신용)정보 처리위탁
      always_on: false        # true면 스크리닝 없이 항상 활성
      screening_question: 위탁 업무에 개인(신용)정보 처리가 포함되는가?
      suggest_keywords: [개인정보, 신용정보]   # 본문 검출 시 활성화 제안
checkpoints:
  - id: OUT-03                # 전역 유일. 유형약어-번호
    title: 재위탁 제한 및 사전 동의
    severity: 필수             # 필수 | 권장 | 참고
    module: M-PRIV            # 생략 시 유형 기본 (항상 포함)
    triggers:
      keywords: [재위탁, 재수탁]   # 조항 본문 포함 검사 (OR)
      patterns: []                # JS 정규식 문자열 (선택)
    absence_check: true       # true: 매칭 조항 없으면 "누락 의심" 보고
    guidance: >
      검토 지침. ~음/~슴 기술식 문체. 조문 인용 시 강행/임의/추정/간주 병기.
    legal_basis:
      - law: 금융기관의 업무위탁 등에 관한 규정   # DB law_name과 일치해야 원문 첨부됨
        article: 제3조                          # "제N조" / "제N조의M" 형태
        verified: false       # 사람이 원문 대조 후에만 true로 승격
    jid_refs: []              # 사내 판단 선례 라벨 (예: J-2026-0496)
    news_refs: []             # briefing.sqlite3 items.id

## 검증 규칙 (build/validate.py가 강제)
- checkpoint 필수 필드: id, title, severity, guidance
- id 전역 유일 / severity는 3값 중 하나 / module은 해당 파일 meta.modules에 선언된 id
- legal_basis 항목은 law·article·verified 필수
- verified: true인데 DB에 원문이 없으면 빌드 경고 + HTML에 [원문 미확인] 배지

## 검수 흐름
Claude 초안(verified: false) → 손남수 원문 대조 → verified: true 승격 → 재빌드
