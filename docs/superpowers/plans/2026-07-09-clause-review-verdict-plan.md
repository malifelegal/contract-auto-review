# 조항별 검토의견 입력·축적 구현 계획

> 사용자 피드백(2026-07-09): 조항별 보기가 메인. 각 확인사항에 **이상없음/검토의견 개진/해당사항 없음**을 표시하고, 이 판정 데이터를 건별 축적해 리포트에 반영·내보내기.

**Goal:** 조항별 보기(및 체크리스트 상세)에서 검토자가 각 검토항목에 대해 3택 판정(이상없음/검토의견/해당없음)과 코멘트를 남기고, 이를 **계약서 건별**로 localStorage 저장·JSON 내보내기/불러오기하며, 종합 리포트에 그 판정·코멘트가 표시되게 함.

**검수 탭과의 구분(중요):** 기존 '검수' 탭은 **지식 정확성**(quote↔DB 원문 대조, verified 승격) 축이다. 이번 기능은 **계약서 건별 검토의견**(이 계약서의 이 항목은 이상없음/의견있음/해당없음) 축으로 완전히 별개다. 데이터·저장키·UI 모두 분리한다.

**전제(실측):** app.js에 hashText(계약서 텍스트 해시), renderClauses(조항별 보기), renderReport(리포트) 존재. 리포트 sign-off는 `cr-<hash>` 키 localStorage 사용 중. 조항별 보기는 renderCompareItem으로 항목 렌더. 검토항목 식별자=cpId. state.result.results[].{cpId,coverage,best}. ES5·전역·module.exports 가드 규약. verdict 3값 한국어.

**데이터 모델:**
```
localStorage["cr-verdict-<hash>"] = {
  "<cpId>": { verdict: "이상없음"|"검토의견"|"해당없음", comment: "", date: "YYYY-MM-DD" }
}
```
- hash = hashText(state.text) — 계약서 건별 격리.
- 내보내기: { meta:{ type_id, date, contract_hash }, verdicts:{...} } JSON.
- 불러오기: 같은 구조 JSON → 해당 hash 키에 복원.
- 집계 분석(여러 건 패턴)은 **후속 과제** — 지금은 건별 저장·내보내기까지. 내보내기 포맷에 meta를 넣어 후속 집계가 가능하도록 열어둠.

---

## Task 1: src/verdict.js — 검토의견 순수 로직 (TDD)

**Files:** Create `src/verdict.js`, `tests/verdict.test.js`

순수 함수(브라우저 전역 Verdict + module.exports):
- `verdictKey(hash)` → `"cr-verdict-" + hash`
- `setVerdict(store, cpId, verdict, comment, date)` → 새 store(불변). verdict가 ""/null이면 해당 cpId 삭제(판정 취소).
- `verdictSummary(store)` → `{ 이상없음:n, 검토의견:n, 해당없음:n, total }`
- `exportVerdicts(store, meta)` → `{ meta, verdicts }` 객체
- `importVerdicts(obj)` → verdicts dict (구조 검증, 잘못되면 {})
- `VERDICTS` = ["이상없음","검토의견","해당없음"] 상수

테스트: set/삭제, summary 집계, export 구조, import 파싱·방어, 잘못된 verdict 값 무시.

## Task 2: app.js — 조항별 보기에 판정 UI + 저장

**Files:** Modify `src/app.js`, `src/style.css`, `src/build_html.py`(JS_ORDER)

- JS_ORDER에 verdict.js 추가(app.js 앞).
- state에 verdictStore 로드: `renderClauses`/`btn-run` 시 `Verdict.verdictKey(hashText(state.text))`로 로드.
- `renderCompareItem(r)`에 판정 영역 추가: 3택 버튼(이상없음/검토의견/해당없음) + 코멘트 입력(검토의견일 때 강조). 현재 판정 활성 표시.
- 버튼 클릭 → verdictStore 갱신 → localStorage 저장 → 해당 항목 리렌더(활성 상태 갱신). 코멘트 change 저장.
- 조항 헤더 카운트에 판정 요약 추가(예: "의견 2").
- 판정은 addressed·verify 항목뿐 아니라 consider(검토 제안) 항목에도 남길 수 있어야 함(해당없음 판정 대상). → 조항별 보기는 조항에 매핑된 것만 나오므로, consider는 리포트 쪽에서 판정 가능하게(Task 4).

## Task 3: 내보내기/불러오기 UI

**Files:** Modify `src/template.html`, `src/app.js`

- 조항별 보기 상단(또는 리포트)에 "검토의견 내보내기"·"불러오기" 버튼.
- 내보내기: Verdict.exportVerdicts(store, {type_id, date, contract_hash}) → `contract-review-verdicts.json` 다운로드.
- 불러오기: file input → importVerdicts → 현재 hash 키에 저장 → 리렌더.

## Task 4: 리포트에 검토의견 반영

**Files:** Modify `src/app.js`

- renderReport에서 각 항목(addressed/verify/consider)에 판정 배지 표시(이상없음=녹/검토의견=주의+코멘트/해당없음=회색).
- 리포트 상단 요약 타일 옆에 검토의견 요약(이상없음 n·검토의견 n·해당없음 n) 추가.
- 검토의견 있는 항목을 별도 섹션 "검토의견 개진 항목"으로 모아 코멘트와 함께 표시(결론성 정보).

## Task 5: 빌드·회귀·브라우저 확인·병합

- pytest·node 회귀. verdict.test.js 그린.
- `python3 build/build_html.py` 풀빌드, dist에 verdict.js 인라인 확인.
- 브라우저: 조항별 보기 3택 동작·저장·새로고침 유지·내보내기·리포트 반영. 콘솔0/외부0.
- 커밋들 → feat/clause-verdict → main.

---

## 실행 메모
- 검수(verified)와 검토의견(verdict)의 저장키·용어를 절대 섞지 않는다.
- verdict는 건별(hash)이라 계약서가 바뀌면 새 판정 세트. 같은 계약서 재분석 시 복원.
- 후속(이번 미구현): 여러 건 verdict 집계로 "자주 검토의견 달리는 항목" 패턴 분석 → 지식 정교화 피드백 루프.
