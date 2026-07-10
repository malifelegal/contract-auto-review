"use strict";
/* PF 네임스페이스 — 파일 추출기(cfb·pdf·doc·hwp·zip)가 등록되는 전역 객체.
   legal-review-finder(폐쇄망 법률검토 앱)의 검증된 추출기를 이식. 서버·외부요청 0.
   추출기 파일보다 먼저 로드되어야 함(JS_ORDER). */
window.PF = window.PF || {};
