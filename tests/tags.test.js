"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const T = require("../src/tags.js");

test("detectTags: 계약명에서 성격 태그 감지", () => {
  assert.deepStrictEqual(T.detectTags("공덕본사 정수기 렌탈 계약서 검토 요청"), ["렌탈·임대"]);
  assert.deepStrictEqual(
    T.detectTags("여의도 파크원 담보대출 리파이낸싱 계약서").sort(),
    ["담보·여신"].sort()
  );
});

test("detectTags: 복수 태그 동시 감지", () => {
  var tags = T.detectTags("재보험사와의 종신특약 추가 합의서 검토");
  assert.ok(tags.indexOf("재보험") !== -1);
  assert.ok(tags.indexOf("변경·합의서") !== -1);
});

test("detectTags: 투자·펀드", () => {
  assert.ok(T.detectTags("에이팩스 일반사모투자신탁 투자의 건").indexOf("투자·펀드") !== -1);
});

test("detectTags: 제휴·MOU", () => {
  assert.ok(T.detectTags("하얏트리젠시와 제휴 협약서 검토 요청").indexOf("제휴·MOU") !== -1);
  assert.ok(T.detectTags("공동개발을 위한 MOU 검토요청").indexOf("제휴·MOU") !== -1);
});

test("detectTags: 이행보증", () => {
  assert.ok(T.detectTags("이행보증 가입 부속약정서").indexOf("이행보증") !== -1);
});

test("detectTags: 해외·영문 (긴 영문 토큰)", () => {
  assert.ok(T.detectTags("New Frontera Voting Agreement 용역계약서").indexOf("해외·영문") !== -1);
  // 짧은 약어(SI, GA)는 해외·영문으로 잡지 않음
  assert.ok(T.detectTags("GA 영업 위탁계약").indexOf("해외·영문") === -1);
});

test("detectTags: 매칭 없으면 빈 배열", () => {
  assert.deepStrictEqual(T.detectTags("일반 계약서 검토"), []);
});

test("detectTags: 리스크는 리스(임대)로 오탐하지 않음", () => {
  assert.ok(T.detectTags("리스크 관리 위탁 계약").indexOf("렌탈·임대") === -1);
});

test("TAGS: 태그 정의 목록 노출", () => {
  assert.ok(Array.isArray(T.TAGS));
  assert.ok(T.TAGS.every(function (t) { return t.id && t.re; }));
});
