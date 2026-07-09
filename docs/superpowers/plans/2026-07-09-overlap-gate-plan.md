# 매칭 정밀도 — 핵심어 복수 겹침 게이트 + 타이틀 가중 구현 계획

> 07-08 피드백(개발_계약서 검토 자동화.md line 13~15) 대응: "단일 키워드 1개만 겹쳐도 매칭 → 가짓수 폭증", "조 타이틀 단어 가중", "최소 복수 키워드 겹침".

**Goal:** char n-gram TF-IDF만으로 `REVIEW_FLOOR=15`를 넘긴 약한 후보(핵심어 겹침 0~1)를 verify에서 quiet로 강등. 단, (a) 명시 인용(citation), (b) 조항 표제와 강일치(표제 핵심어 50%+ 겹침)는 예외로 통과. 표제어 겹침이 본문어 겹침보다 신뢰도 높다는 도메인 사실을 게이트에 반영.

**진단(실측, samples/sample_outsourcing.txt, 전 모듈 활성):**
- 재위탁금지 조항(조항5)에 8건 매칭 — 전부 재위탁을 다른 각도로 규율하는 **정당한 별개 검토항목**(감독원장보고·개인정보/신용정보 재위탁·해외위탁·클라우드). 노이즈 아님. 억제 대상 아님.
- 순수 n-gram 오탐은 **CMN-03(위탁수수료), 핵심어 겹침 0** 단 1건.
- 표제 강일치 매칭(CMN-06 계약기간 score41, CMN-15 비밀유지 score30)은 본문 겹침 1이지만 표제가 정확히 일치 → **유지해야 할 진짜 매칭**. "타이틀 가중" 요구의 정확한 반영 지점.

**게이트 규칙 (검토 보조 화법 유지 — verify를 quiet로만 강등, 매핑 자체는 보존):**
```
후보 자격 = citation
         OR 고유핵심어겹침 >= OVERLAP_MIN(2)
         OR 표제강일치(표제 핵심어의 TITLE_STRONG_RATIO(0.5)+ 가 check 핵심어와 겹침)
```
- 고유핵심어겹침: 조항(표제어+본문어 **합집합**, 2글자+ 한글) ∩ check 대표텍스트 핵심어. 중복 제거.
- 미달 시: tier 값(confirmed/review)은 유지하되 **coverage를 quiet로 강등** → UI에서 접힘. addressed(짚음)도 겹침 0이면 강등(단 addressed는 citation/강점수라 실질적으로 살아남음).
- consider(부재 알람)는 이 게이트 영향 없음 — 부재는 겹침 계산 대상 아님.

**타이틀 가중 강화(부수):** 표제강일치를 게이트 예외로 승격시켜 표제어 가중을 게이트 레벨로 끌어올림. 기존 titleBonus(점수 가산, TITLE_BONUS_MAX=5)는 유지.

**전제:** analyze는 이미 coverage 파생(addressed/verify/consider/quiet). coverageOf(tier,check)에 겹침 신호를 주입해야 함 → analyze 내부에서 best 후보의 겹침을 계산해 coverage 강등. matcher.test.js 34 test. JS_ORDER 변경 없음(matcher.js만 수정).

---

## Task 1: sim.js — 핵심어 집합·겹침 헬퍼 (TDD)

**Files:** `src/matcher.js`(신규 함수), `tests/matcher.test.js`

- 신규 순수 함수 `overlapFeatures(clause, check)` → `{uniq, titleStrong}`:
  - `uniq`: (조항 표제어 ∪ 본문어) ∩ checkText 핵심어 개수 (Sim.keywords 사용, 2글자+ 한글).
  - `titleStrong`: 조항 표제 핵심어 중 check와 겹친 비율 ≥ TITLE_STRONG_RATIO && 최소 1개.
- `MatcherConfig`에 `OVERLAP_MIN: 2`, `TITLE_STRONG_RATIO: 0.5` 추가.
- 테스트: 겹침 2 계산 정확 / 표제어 전부 겹치면 titleStrong / 표제 무 → titleStrong false / 합집합 중복제거(표제어=본문어 중복 시 1회).

## Task 2: matcher.js — coverage 겹침 게이트 (TDD)

- `passesOverlapGate(clause, check, citation)` = citation || uniq>=OVERLAP_MIN || titleStrong.
- `analyze`에서 각 result의 best 후보에 대해 게이트 평가 → 미달이면 `coverage`를 quiet로 강등(tier는 보존, matches에서도 제외되도록 coverage 기준으로). `matches`는 coverage!=="quiet"인 best만.
- 게이트 통과 정보 result에 노출(디버그·reason용): best.gate = {uniq, titleStrong, passed}.
- 테스트: CMN-03류(겹침0) quiet 강등 / 표제강일치(겹침1) 유지 / 겹침2+ 유지 / citation 겹침0이어도 유지 / consider 무영향.

## Task 3: 통합 스모크 + 회귀 + 빌드

- 샘플 재실행: 유지/강등 카운트, CMN-03 강등·재위탁 8건 보존 확인.
- `node --test tests/*.test.js` 회귀(34+신규). `python3 -m pytest tests/ -q`.
- `python3 build/build_html.py` 풀빌드, dist grep으로 게이트 함수 인라인 확인.
- 커밋: "feat: 매칭 게이트 — 핵심어 복수 겹침 + 표제 강일치 예외".

## Task 4: 브라우저 E2E + 병합

- dist 열어 verify 개수 감소·재위탁 항목 보존·조용한 오탐 사라짐 육안 확인, 콘솔 0/외부요청 0.
- 브랜치 overlap-gate → main ff-merge → push.
