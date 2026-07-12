# 화해계약 유형 신설 + 계약 성격 배타 게이트 (A3·B1)

> 실사용 피드백 ②: 민법 화해계약인데 상법 주식회사 절차(주주총회 특별결의·이사회 승인 등)를 필수로 띄움. "법무 검토가 안 되어서 생기는 문제". 결정: A3(화해계약 유형 신설, 상법 유형과 경쟁·배제) + B1(legal 스킬은 성격판정 규칙 큐레이션에만, 런타임 오프라인 유지).

## 근본 원인
- 유형 감지 = `detectType`의 detect_keywords raw count 최댓값(matcher.js:17). 계약의 **법적 성격**(민법 화해 vs 상법 조직행위) 판정 층 없음.
- 직접 유발자: shareholders detect_keywords에 `합의서` 포함 → 화해**합의서**가 shareholders로 오탐(재현: 샘플 score 2). **수정 완료** — `합의서` 제거, type_name 정리.

## 구현 (2층)
### 1. 지식 층 (빌드타임, legal 큐레이션 = B1)
- `knowledge/types/settlement.yaml` 신설 — 민법 화해계약 유형. 원문 검증된 checks(민법 §731 화해 의의·§732 창설적 효력·§733 착오, 부제소합의 판례, 청구권 포기 특정성, 화해금 조건, 분쟁 대상 특정 등). legal 에이전트가 원문 확인 후 산출.
- 성격 분류 기준: 화해 강신호 어휘 vs 상법 진성 신호 어휘 목록.

### 2. 런타임 층 (오프라인, 규칙기반 = A3)
- **detectType 성격 게이트**: 화해 강신호가 지배적이면 상법 계열 유형(shareholders 등) 점수를 감쇄하거나 settlement를 우선. LLM 불사용 — legal이 준 어휘목록으로 결정론적 실행.
- 후보: settlement.meta에 `nature_signals`(강신호)·`suppresses`(억제 대상 type_id 목록) 필드. detectType이 강신호 임계 초과 시 suppresses 유형 점수 0/감점.

## 검증 목표
- 화해합의서 샘플(주식 언급 포함) → settlement 감지, shareholders 상법 필수 미로드.
- 진성 주주간계약(주주간·의결권·우선매수 등 지배) → shareholders 정상 감지.
- 기존 테스트 회귀 없음. 빌드 스모크 통과.

## 상태
- [x] shareholders `합의서` 제거(오탐 직접 유발자) + type_name 주주간계약으로 정리
- [x] settlement.yaml (legal 에이전트 원문검증 산출 검수·반영, check 9개). 판례는 기존 관례대로 note 서술(basis statute/practice), verified 조문 3개(§731~733) + 판례 3건 원문확인. 부제소 유효요건 법리는 미확인으로 note 표기.
- [x] detectType 성격 게이트(nature_signals/suppresses, NATURE_MIN=2). 화해 강신호 복수→shareholders 억제. 테스트 2개(오탐차단·진성유지) 통과.
- [x] 유형 목록 UI에 settlement 노출(app.js:309 CR.types 자동 populate)
- [x] 회귀·빌드 — JS 전체+py 56 통과, 빌드 스모크 check 260개(+9)

## 법무 검수 노트
- SETTLE-01·02·03: 민법 §731~733 원문(vault) 근거. norm_type 실무이나 성립요건이라 필수 — severity_override로 명시.
- SETTLE-05(부제소)·06(청구권포기): 직접 조문 없어 basis practice(판례법리). 대법원 2024다256932·2020다227523 원문확인, note 서술.
- 판례 3건 전부 korean-law MCP includeText로 원문확인. 부제소 '특정 법률관계 한정·예상가능' 법리는 원문 미대조 → 미확인 표기.
