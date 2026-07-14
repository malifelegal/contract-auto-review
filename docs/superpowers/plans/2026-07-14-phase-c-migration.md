# Phase C — 분류 재설계 마이그레이션 (확정안: 9유형 + 횡단 12모듈)

> Phase B 확정(2026-07-14): 종합 추천안 그대로 — 9유형(조달/업무위탁/여신담보/투자운용/판매모집채널/사업제휴/정보비밀/지분조직/화해) + 횡단모듈(X-PII·X-EFIN·X-CLOUD·X-SUB·X-INSMOD·X-ASSET·X-SEC·X-REINS·X-IP·X-COMP·X-RELATED·X-CROSS). ⑤ 리스크 재검수 동시 수행.

## 아키텍처 결정: 횡단모듈은 common.yaml에 수용
- 근거(안3 발견): 엔진이 이미 (a) `allModules = common.meta.modules ++ doc.meta.modules`(app.js) (b) `activeCheckpoints`의 모듈 필터를 지원. common의 module 붙은 check는 활성 모듈일 때만 적용 — 정확히 원하는 동작.
- 새 파일·페이로드 변경 없음(validate/enrich/build/verify 무변경). 부수 이득: 유형 미확정 계약에도 횡단 스크리닝 적용.
- check id는 canonical 원본 id 유지(PRIV-01 등) — 골드셋·코퍼스(cpId 키) 참조 보존. 삭제되는 중복본의 코퍼스 데이터만 소실(중복 정리 비용으로 수용).

## 스테이지
- **C1 엔진**(직접): renderScreening·goldset_runner가 common+type 모듈을 병합 스크리닝(미확정 시 common만이라도). 테스트.
- **C2 횡단 풀 구축**(병렬 에이전트): 중복 통합·이동 — canonical 선정 기준: 최다·최신·검수(verified) 우수 벌.
  - X-PII: outsourcing M-PRIV(15) + it-out M-PRIV(10) + nda M-PII(2) + alliance M-PII(3) → 1벌(~15)
  - X-EFIN: outsourcing M-IT(13) + it-out M-ITSEC(15) → 1벌(~15, §60 conditional·activation strong 유지)
  - X-CLOUD: 2벌(7+7) → 1벌(7)
  - X-SUB: service-purchase M-PAY 하도급 checks 이동(전 유형 발동 가능해짐)
  - X-INSMOD: outsourcing M-SOLICIT + alliance 모집 → 1벌
  - X-ASSET: finance M-ASSET + investment 규제 checks
  - X-SEC(신설 승격): finance M-SEC 담보 checks → 횡단(채널 예금질권 등 유형 무관 발동)
  - X-IP: it-out M-DELIV 산출물·지재권
  - X-COMP: alliance M-COMP + shareholders M-ANTITRUST(기업결합)
  - X-REINS: alliance 재보험
  - X-RELATED(신규 작성): 대주주·계열사 거래제한(보험업법 §111 등 — 원문 검증 필수)
  - X-CROSS(신규 작성): 국외·준거법·관할(실무 기반)
- **C3 유형 재편**(직접+에이전트): 9유형 yaml — procurement(service-purchase+it-out 잔여+임대차), outsourcing(위탁 core), finance(여신), investment, channel(신설: 판매·모집), alliance(잔여 제휴), infosec(nda 확장), shareholders, settlement. detect_keywords 재구축(안1 실측 어휘: 투자1402·대출1246·용역693·위탁522·협약496 등). 구 type_id 매핑(it-outsourcing→procurement 등).
- **C4 ⑤리스크 재검수**(병렬 에이전트): 전 check 회사 리스크 관점 severity 재조정(severity_override+risk 근거), 신규 리스크 체크(배상 상한·일방해지·자동갱신·면책 불균형), 중립 제한 플래그.
- **C5 검증**: 골드셋 재라벨+9유형×2 확장, 전체 회귀, Phase D 6,631건 시뮬레이션(감지율·오분류·미분류율).

## 지식 수술 안전 규칙 (에이전트 필수)
1. verified 근거(sources)와 severity_basis·note는 canonical로 온전 이전 — 내용 발명 금지.
2. 각 스테이지 후 validate + goldset + pytest + JS 통과 확인.
3. 삭제 전 id 참조 grep(goldset cases·tests·docs).
4. §60 계열의 tier:conditional·activation:strong, PII의 activation:confirm, absence_precondition 등 기존 게이트 속성 보존.

## 완료 기록 (2026-07-14)
- [x] C1 엔진(59d632c): common 모듈 병합 스크리닝 — 무회귀
- [x] C2 횡단 12모듈(4879220·e5dce57): 중복 33 소멸+신규 14, 신규 모듈 원문 전수검증(REL-07 quote 교정)
- [x] C3 9유형(d04fc39): procurement·channel 신설, it-outsourcing 해체, 골드셋 9/9
- [x] C4 리스크 재검수(bdd892b): 상향 11·CMN 편면성 재작성 4·신규 5·중복 기각 6 — check 249
- [x] Phase D 인프라(7807675): 6,631건 시뮬레이션, detect 공백 보강 — 감지 68→73.2%(계약명 하한)
