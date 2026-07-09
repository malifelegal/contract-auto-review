# 협업 가이드 — 분산 검수 워크플로우

법무팀이 여럿이 지식(체크리스트 근거 조문)을 **나눠서 검수**하고, 결과를 **한 명이 취합**해 반영하는 흐름. GitHub로 코드·지식을 공유하고, 검수 판정은 각자 내보내 취합한다.

## 한눈에

```
클론·빌드 → 각자 검수(브라우저) → verification.json 내보내기
   → verifications/ 폴더에 모음 → 병합(merge) → 승급(apply) → 재빌드 → 커밋·PR
```

- 지식은 처음에 전부 `verified: false`(원문 미대조). 검토자가 quote↔DB 원문을 눈으로 대조해 `verified: true`로 승급한다.
- 검수는 **안전 우선** — 한 명이라도 "수정필요"로 본 항목은 승급하지 않고 큐레이터가 재검토한다.

## 1. 팀원 준비 (최초 1회)

리포 접근 권한을 받은 뒤:

```bash
git clone https://github.com/nss133/contract-review.git
cd contract-review
python3 build/build_html.py        # dist/contract-review.html 생성
```

> DB 원본 없이 **클론만으로 빌드된다.** 앱이 인용하는 조문만 담은 스냅샷(`data/law_snapshot.sqlite`)이 커밋돼 있기 때문. 대용량 원본 DB는 지식 확장 담당자만 로컬에 둔다.

## 2. 각자 검수 (브라우저)

1. `dist/contract-review.html`을 브라우저로 연다.
2. **검수** 탭 → 항목마다 좌(발췌 quote) ↔ 우(DB 원문)를 대조.
3. 판정: **확인**(원문 일치) / **보류** / **수정필요**(불일치·오기 — 메모 남김).
4. **판정 내보내기** → `verification.json` 다운로드.
5. 파일명을 **본인 이름**으로 바꾼다: `손남수.json`.

> 판정은 브라우저 localStorage에 누적되므로 여러 세션에 나눠 해도 된다. 담당 유형만 골라 검수하려면 상단 유형·상태 필터를 쓴다.

## 3. 취합 (한 명이 수행)

팀원들이 보낸 파일을 `verifications/` 폴더에 모은다:

```
verifications/
  손남수.json
  김검토.json
  이심사.json
```

병합:

```bash
python3 build/merge_verifications.py verifications/ -o data/merged_verification.json
```

출력 예:

```
검토자 3명: 김검토, 손남수, 이심사
병합: 확인 41건(승급 대상) / 수정필요 5건(보류)
판정 충돌(수정필요로 보류): 2건
  - CMN-12#0: 김검토=확인, 손남수=수정필요
  - NDA-15#0: 손남수=확인, 이심사=수정필요
```

**병합 규칙(보수적):**

| 팀원 판정 | 병합 결과 |
|---|---|
| 전원 확인 | 확인 → 승급 대상 |
| 전원 수정필요 | 수정필요 → 보류(합의) |
| 확인·수정필요 혼재 | 수정필요 → 보류 + **충돌** 목록에 표시 |

충돌·수정필요 항목은 큐레이터가 원문을 다시 보고 지식(quote·조문)을 고친 뒤, 다음 라운드에서 재검수한다.

## 4. 승급·재빌드

```bash
python3 build/apply_verification.py data/merged_verification.json
python3 build/build_html.py
```

- "확인" 항목의 지식 YAML `verified: false` → `true`로 승급(포맷·주석 보존, 멱등).
- "수정필요"는 YAML 미변경 + 콘솔에 큐레이터 확인 목록 출력.
- 누가 무엇을 승급했는지는 `data/verification_log.json`(감사 로그, reviewers 포함)에 남는다.
- 재빌드하면 승급된 항목이 앱에서 "원문확인"(녹) 배지로 바뀐다.

## 5. 반영 (커밋·PR)

```bash
git switch -c chore/verify-round-1
git add knowledge/ dist/contract-review.html
git commit -m "chore: 검수 승급 1차 (손남수·김검토·이심사)"
git push origin chore/verify-round-1
# GitHub에서 PR → main 병합
```

- 커밋 대상은 **지식 YAML의 verified 변경 + 재빌드된 dist**.
- 개별 `verifications/*.json`과 감사 로그는 `.gitignore`로 제외된다(작업 파일). 승급 사실은 YAML과 커밋 이력에 남으므로 별도 커밋 불필요.

## 데이터를 함께 나누는 두 가지 목적

| 목적 | 필요한 것 | 방법 |
|---|---|---|
| **검수·사용만** | 클론 + 스냅샷(커밋됨) | git clone → 빌드. 별도 전달 불필요 |
| **지식 확장**(새 조문 인용) | 원본 법령 DB | 담당자만 로컬 보유. `build/config.py`의 `EXTERNAL_LAW_DBS` 참조 → `extract_snapshot.py`로 스냅샷 갱신 |

새 조문을 인용해 지식을 넓히는 작업은 원본 DB가 있는 담당자가 맡고, 나머지 팀원은 스냅샷만으로 검수·사용한다.

---

브랜치·커밋·테스트 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md) 참조.
