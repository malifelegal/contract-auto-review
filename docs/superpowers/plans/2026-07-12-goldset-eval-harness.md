# 골드셋 평가 하네스 (P1) — 정확도의 측정 인프라

> 프로젝트 재검토(2026-07-12)에서 확인된 최대 약점: 오탐 3건(§60·화해·질권)을 전부 사용자가 발견했고, 정확도를 숫자로 말할 수단이 없었음. 반복되는 오탐 지적 = 프롬프트가 아니라 구조(평가셋)로 풀 신호. 이후 모든 게이트·지식 변경은 이 채점의 before/after로 판단한다.

## 구조
- `tests/goldset/cases/*.yaml` — 라벨 케이스. 필드: `id`/`desc`/`text`(계약 본문)/`detect_expected`(기대 유형)/`consider_must_include[]`(누락검출 유지 확인)/`consider_must_exclude[]`·`consider_must_exclude_prefix[]`(오탐 금지).
- `build/goldset_runner.js` — **앱과 동일 파이프라인 재현**(detectType 1위 채택 → renderScreening과 같은 always_on+제안 모듈활성 → analyze). 브라우저와 같은 src/ 소스를 그대로 require — 별도 재구현 없음.
- `build/goldset.py` — 지식 YAML→JSON 브리지, 러너 실행, 채점·스코어카드 출력. CLI: `python3 build/goldset.py` (실패 시 exit 1).
- `tests/test_goldset.py` — pytest 게이트. 전 케이스 통과를 회귀로 강제.

## 초기 케이스 6건 (첫 실행 6/6 통과)
| # | 케이스 | 고정하는 것 |
|---|---|---|
| 01 | 콜센터 위탁 | §60 계열(IT-*) 오탐 금지 — activation:strong 게이트 |
| 02 | 화해합의서(주식 언급) | settlement 감지 — nature_signals 배타 게이트 |
| 03 | 근저당 대출(질권 無) | FIN-SEC-02·05 오탐 금지 — absence_precondition |
| 04 | 질권 설정만(대항요건 無) | FIN-SEC-02 누락검출 **유지** — 게이트의 반대면 |
| 05 | 진성 주주간계약(화해 1회) | shareholders 미억제 — 성격게이트 부작용 방지 |
| 06 | NDA | 기본 감지 안정성 |

## 운용 규칙
1. **새 오탐 발견 시 케이스 추가가 첫 조치** — 수정보다 먼저 실패하는 케이스를 만들어 고정.
2. 게이트/지식/엔진 변경 PR은 `python3 build/goldset.py` 스코어카드 before/after 첨부.
3. 검토의견(verdict) 내보내기 JSON은 라벨과 동형('해당없음'=그 계약에서 그 check는 무관) — 실검토가 쌓이면 케이스로 승격하는 경로가 정규 성장 방식.

## 관찰 (다음 작업 재료)
- 케이스 01(콜센터)의 consider가 11건 — 오탐 금지 항목은 없지만 절대량이 여전히 많음. P2(필수 145개 게이트 전수 스캔)의 정량 기준선으로 사용.

## 남은 것
- [ ] 케이스 확충: 실계약 15~30건 (사용자 실검토 verdict → 케이스 승격 경로)
- [ ] P2 전수 스캔 후 consider_n 감소 측정
- [ ] addressed(반영) 검출 recall 케이스 추가(지금은 detect·consider 중심)
