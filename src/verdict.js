"use strict";
/* 조항별 검토의견(verdict) 순수 로직 — 계약서 건별 판정 축.
   '검수'(verified: 지식 정확성)와는 완전 별개. 이건 "이 계약서의 이 항목은
   이상없음/검토의견/해당없음" 이라는 검토자 의견을 건별로 축적한다.
   브라우저 전역 Verdict + node require 겸용. */
var Verdict = (function () {
  var VERDICTS = ["이상없음", "검토의견", "해당없음"];

  function verdictKey(hash) { return "cr-verdict-" + hash; }

  function _clone(store) {
    var out = {};
    for (var k in store) if (Object.prototype.hasOwnProperty.call(store, k)) out[k] = store[k];
    return out;
  }

  // verdict가 빈값/null이면 판정 취소(삭제). 허용 안 되는 값이면 원본 유지.
  function setVerdict(store, cpId, verdict, comment, date) {
    var next = _clone(store || {});
    if (!verdict) { delete next[cpId]; return next; }
    if (VERDICTS.indexOf(verdict) === -1) return store || {};
    next[cpId] = { verdict: verdict, comment: comment || "", date: date || "" };
    return next;
  }

  function verdictSummary(store) {
    var sum = { "이상없음": 0, "검토의견": 0, "해당없음": 0, total: 0 };
    store = store || {};
    for (var k in store) {
      if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
      var v = store[k] && store[k].verdict;
      if (VERDICTS.indexOf(v) !== -1) { sum[v]++; sum.total++; }
    }
    return sum;
  }

  function exportVerdicts(store, meta) {
    return { meta: meta || {}, verdicts: _clone(store || {}) };
  }

  // 구조 검증: verdicts dict만 신뢰, 각 항목의 verdict 값이 유효한 것만 통과.
  function importVerdicts(obj) {
    if (!obj || typeof obj !== "object") return {};
    var v = obj.verdicts;
    if (!v || typeof v !== "object") return {};
    var out = {};
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      var item = v[k];
      if (item && VERDICTS.indexOf(item.verdict) !== -1) {
        out[k] = { verdict: item.verdict, comment: item.comment || "", date: item.date || "" };
      }
    }
    return out;
  }

  // 일괄 판정(통과계약 모드): cpIds 중 '미판정'인 것만 verdict로 채움 — 이미 찍은 판정(예외 지정분)은 보존.
  // 반환: { store, applied } — applied는 실제 채워진 개수.
  function bulkVerdict(store, cpIds, verdict, date) {
    if (VERDICTS.indexOf(verdict) === -1) return { store: store || {}, applied: 0 };
    var next = _clone(store || {});
    var applied = 0;
    (cpIds || []).forEach(function (id) {
      if (next[id] && next[id].verdict) return; // 기판정 보존
      next[id] = { verdict: verdict, comment: "", date: date || "" };
      applied++;
    });
    return { store: next, applied: applied };
  }

  return {
    VERDICTS: VERDICTS,
    verdictKey: verdictKey,
    setVerdict: setVerdict,
    bulkVerdict: bulkVerdict,
    verdictSummary: verdictSummary,
    exportVerdicts: exportVerdicts,
    importVerdicts: importVerdicts
  };
})();

if (typeof module !== "undefined") module.exports = Verdict;
