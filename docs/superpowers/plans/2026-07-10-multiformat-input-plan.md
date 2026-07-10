# 다형식 파일 입력 구현 계획 (PDF·DOC·HWP·HWPX)

> 사용자 요청: docx 외 PDF·doc·hwpx·hwp도 입력 가능해야. legal-review-finder(폐쇄망 법률검토 앱)의 검증된 브라우저 추출기를 이식 — 서버·kordoc 불필요, 완전 오프라인 단일 HTML 유지.

## 핵심 결정
- **오프라인 단일 HTML 원칙 유지.** legal-review-finder가 이미 서버 없이 브라우저에서 PDF/doc/hwp/hwpx를 파싱함(pdf.js·CFB·JSZip 인라인). kordoc(MCP)은 서버 경유라 오프라인 원칙 위배 → 사용 안 함.
- 검증된 추출기·vendor를 **재사용 이식**(신규 개발 아님). legal-review-finder는 단위 142건 + 브라우저 통합 테스트로 검증됨.

## 이식 대상 (출처: ~/legal-review-finder/)
vendor (커밋):
- vendor/pdf.min.js (368KB), vendor/pdf.worker.min.js (1.1MB) — 신규
- vendor/jszip.min.js — 이미 계약서 앱에 있음(동일 3.10.1 확인 필요)

추출기 (src/app/ → 계약서 src/):
- 04b-cfb.js → src/cfb.js (OLE 복합문서 리더, PF.cfb)
- 05-extract-pdf.js → src/extract-pdf.js (PF.extractPdf, blob/fake worker)
- 06-extract-doc.js → src/extract-doc.js (PF.extractDoc, CFB 의존)
- 06-extract-hwp.js → src/extract-hwp.js (PF.extractHwp, CFB+deflate)
- 06-extract-zip.js → src/extract-zip.js (PF.extractDocx/extractHwpx, JSZip)
- eml은 계약서에 불필요 — 제외

## 계약서 앱 적응
- **PF 네임스페이스 도입**: 현재 docx.js는 전역 extractDocx. PF.* 방식으로 통일하거나, 이식 추출기의 PF를 앱에 정의(`window.PF = {}`). 기존 extractDocx는 PF.extractDocx로 대체(중복 제거).
- **build_html.py**: JS_ORDER에 cfb·extract-* 추가(순서: cfb 먼저). VENDOR 인라인에 pdf.min.js 추가 + pdf.worker.min.js를 `<script type="text/plain" id="pdfjs-worker-src">` 블록으로 template에 인라인.
- **template.html**: docx-file input의 accept를 `.docx,.pdf,.doc,.hwp,.hwpx`로 확대. pdfjs-worker-src 블록 추가.
- **app.js 파일 핸들러**: 확장자로 분기 → 적절한 PF.extract* 호출. 실패 시 "텍스트로 복사해 붙여넣으세요" 안내(기존 fallback 유지). 스캔 PDF·구형 hwp는 추출 실패로 안내.

## 테스트
- legal-review-finder의 추출기 단위 테스트 로직 참고. 계약서 앱엔 node 테스트 어려움(pdf.js는 브라우저 의존) → 최소 node --check + 샘플 파일로 브라우저 수동 확인.
- 샘플: legal-review-finder/fixtures의 sample.pdf/docx/doc 재사용 가능.

## 빌드 크기
- dist 현재 901KB → pdf.js+worker 추가로 ~2.4MB 예상. 오프라인 단일파일이라 허용(legal-review-finder도 1.6MB).

## 함정(legal-review-finder 주석에서)
- pdf.js worker: file://에선 외부 워커 로드 불가 → blob URL 워커, 실패 시 fake worker(메인스레드 eval) 폴백. 이 로직 그대로 이식.
- `</script` 안전: worker 소스 블록은 text/plain. base64 아님이라 `</script` 포함 시 깨질 수 있음 → legal-review-finder가 어떻게 처리하는지 확인(pdf.worker.min.js에 </script 있으면 이스케이프 필요).
- CFB deflate: hwp는 deflate-raw 사용. 브라우저 DecompressionStream 또는 자체 구현 확인.

## A(UI 다듬기) 병행 — 사용자가 함께 요청
파일형식 작업과 함께 리뷰 저순위 UI 이슈도:
- 리포트에 검토의견 내보내기 버튼 추가(현재 조항별보기만).
- (선택) sign-off vs verdict 이원화 정리.

## 순서
1. vendor 복사(pdf.min.js·pdf.worker.min.js) + jszip 버전 확인.
2. 추출기 5개 이식 + PF 네임스페이스 도입, docx.js를 extract-zip로 대체.
3. build_html.py·template 수정(VENDOR 인라인·worker 블록·accept).
4. app.js 파일 핸들러 확장자 분기.
5. 빌드·node --check·브라우저 샘플 확인(pdf·docx·hwpx·doc).
6. A: 리포트 verdict export 버튼.
7. 커밋 → main.
