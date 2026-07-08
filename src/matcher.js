"use strict";
/* 매칭 엔진 v3 — 다신호 점수(tfidf·jaccard) + 규범/표제/인용 보너스 + tier 게이트.
   단일 키워드 이진 매칭(v2)을 대체. 전부 순수 함수.
   의존: Sim(sim.js)·ClauseRole(clause_role.js)·MatcherConfig(matcher_config.js).
   node에서는 require, 브라우저(빌드 연결)에서는 앞서 로드된 전역을 사용.
   tier 계단은 comp_matching_auto/matcher/review_rules.py evaluate_review 이식·적응. */

// ── 의존 로드 (node: require / 브라우저: 전역) ─────────────────────
// 브라우저 연결 시 var 재선언은 이미 정의된 전역값을 덮지 않음(no-op) — if 블록 미실행.
if (typeof require !== "undefined") {
  var Sim = require("./sim.js");
  var ClauseRole = require("./clause_role.js");
  var MatcherConfig = require("./matcher_config.js");
}

// ── 유형 감지·모듈 제안 (v2 유지) ────────────────────────────────
function detectType(text, types) {
  return types
    .map(function (t) {
      var score = (t.meta.detect_keywords || []).reduce(function (s, kw) {
        return s + (text.split(kw).length - 1);
      }, 0);
      return { typeId: t.meta.type_id, score: score };
    })
    .sort(function (a, b) { return b.score - a.score; });
}

function suggestModules(text, modules) {
  return modules
    .filter(function (m) { return !m.always_on; })
    .filter(function (m) {
      return (m.suggest_keywords || []).some(function (kw) { return text.indexOf(kw) !== -1; });
    })
    .map(function (m) { return m.id; });
}

function activeCheckpoints(doc, activeModules) {
  return doc.checkpoints.filter(function (cp) {
    return !cp.module || activeModules.indexOf(cp.module) !== -1;
  });
}

// ── 규범유형 매핑 (check.norm_type ↔ 조항 규범유형) ───────────────
// check.norm_type: 강행|임의|추정|간주|실무 (조문 성격)
// ClauseRole.normType(body): 금지|의무|권한|선언|null (문장 어미)
var NORM_MAP = {
  "강행": { "의무": 1, "금지": 1 }, // 하여야 한다/아니 된다
  "임의": { "권한": 1 },            // 할 수 있다
  "추정": { "선언": 1 },            // 본다/추정
  "간주": { "선언": 1 }             // 간주/본다
  // "실무": 규범 근거 없음 → 매핑 없음(보너스 대상 아님)
};
function normMatches(clauseNorm, checkNorm) {
  if (!clauseNorm) return false;
  var m = NORM_MAP[checkNorm];
  return !!(m && m[clauseNorm]);
}

// ── 텍스트 표현 ──────────────────────────────────────────────────
// check 대표 텍스트 = 질문 + 근거조문 quote + 큐레이션 키워드 + 근거조문 표제/항.
function checkText(check) {
  var parts = [String(check.check || "")];
  var sources = check.sources || [];
  sources.forEach(function (s) {
    if (s.quote) parts.push(String(s.quote));
    var title = ClauseRole.parseTitle(s.article || "");
    if (title) parts.push(title);
    else if (s.clause) parts.push(String(s.clause));
  });
  var kws = (check.triggers && check.triggers.keywords) || [];
  if (kws.length) parts.push(kws.join(" "));
  return Sim.preprocess(parts.join(" "));
}

// clause 질의 = 표제(TITLE_K회 반복) + 표제 + 본문. 표제 용어 TF 가중(스펙 B).
function clauseQuery(clause) {
  var title = ClauseRole.parseTitle(clause.heading || "");
  var rep = "";
  for (var i = 0; i < MatcherConfig.TITLE_K; i++) rep += title + " ";
  return Sim.preprocess(rep + String(clause.heading || "") + " " + String(clause.body || ""));
}

// 활성 check 코퍼스로 IDF 빌드 → {idf, checks:[{cp, text, doc}]}
function buildModel(docs, activeModules) {
  var checks = [];
  docs.forEach(function (d) {
    activeCheckpoints(d, activeModules).forEach(function (cp) {
      checks.push({ cp: cp, text: checkText(cp), doc: d });
    });
  });
  var idf = Sim.buildIdf(checks.map(function (c) { return c.text; }));
  return { idf: idf, checks: checks };
}

// ── 명시 인용 감지 (comp citation_extract 차용, 축약) ─────────────
// clauseText 에 check 근거의 "법령명(핵심 2~4글자+) + 제N조(번호 일치)"가 함께 나오면 true.
// 과탐 방지: 제N조 숫자 일치 필수 + 법령명 핵심 문자열 존재 필수.
function _lawCore(law) {
  var b = String(law || "").replace(/\s+/g, "");
  b = b.replace(/(등에관한규정|에관한규정|등에관한법률|에관한법률|시행세칙|시행규칙|시행령|감독규정|규정|법률|법)$/, "");
  return b;
}
function citationHit(clauseText, check) {
  var q = String(clauseText || "").replace(/\s+/g, "");
  var sources = check.sources || [];
  for (var i = 0; i < sources.length; i++) {
    var m = String(sources[i].article || "").match(/제\s*(\d+)\s*조(?:의\s*(\d+))?/);
    if (!m) continue;
    var pat = "제" + m[1] + "조" + (m[2] ? "의" + m[2] : "");
    if (q.indexOf(pat) === -1) continue; // 조문번호 일치 필수
    var core = _lawCore(sources[i].law);
    if (core.length < 2) continue;
    var probe = core.length > 4 ? core.slice(0, 4) : core; // 핵심 2~4글자
    if (q.indexOf(core) !== -1 || q.indexOf(probe) !== -1) return true;
  }
  return false;
}

// ── 표제 보너스 ──────────────────────────────────────────────────
// clause 표제 용어와 check 핵심어(대표 텍스트 키워드) 겹침 → 소폭 가산(상한 TITLE_BONUS_MAX).
function titleBonus(clause, checkTextStr) {
  var title = ClauseRole.parseTitle(clause.heading || "");
  if (!title) return 0;
  var tkw = Sim.keywords(title);
  var ckw = Sim.keywords(checkTextStr);
  var overlap = 0;
  for (var k in tkw) if (ckw[k]) overlap++;
  if (!overlap) return 0;
  return Math.min(overlap * 2, MatcherConfig.TITLE_BONUS_MAX);
}

// ── 조항×체크 점수 ───────────────────────────────────────────────
function scoreClauseCheck(clause, checkEntry, model) {
  var cq = clauseQuery(clause);
  var tfidf = Sim.cosine(Sim.tfidfVec(cq, model.idf), Sim.tfidfVec(checkEntry.text, model.idf)) * 100;
  var jaccard = Sim.jaccard(cq, checkEntry.text) * 100;
  var isShort = String(clause.body || "").length < MatcherConfig.SHORT_LEN;
  var tw = isShort ? MatcherConfig.TW_SHORT : MatcherConfig.TW;
  var jw = isShort ? MatcherConfig.JW_SHORT : MatcherConfig.JW;
  var clauseNorm = ClauseRole.normType(clause.body);
  var nMatch = normMatches(clauseNorm, checkEntry.cp.norm_type);
  var nBonus = nMatch ? MatcherConfig.NORM_BONUS : 0;
  var tBonus = titleBonus(clause, checkEntry.text);
  var citation = citationHit(String(clause.heading || "") + " " + String(clause.body || ""), checkEntry.cp);
  var raw = tw * tfidf + jw * jaccard + nBonus + tBonus;
  var score = Math.max(0, Math.min(100, raw));
  var signals = (tfidf > 0 ? 1 : 0) + (jaccard > 0 ? 1 : 0);
  return {
    score: score, tfidf: tfidf, jaccard: jaccard,
    normMatch: nMatch, titleBonus: tBonus, citation: citation, signals: signals
  };
}

// ── tier 판정 (comp review_rules.evaluate_review 계단 이식·적응) ───
// rankedForCheck: 그 check에 대해 REVIEW_FLOOR 이상인 후보 조항 {clause, s} 내림차순.
//   (전 조항을 넣지 않고 후보로 한정 — "단일 후보"·margin 의미 보존, 근접-0 러너업의 margin 과확정 차단.)
function decideTier(ranked, check) {
  if (!ranked.length) return "none";
  var best = ranked[0];
  if (best.s.score < MatcherConfig.REVIEW_FLOOR) return "none";
  var role = ClauseRole.clauseRole(best.clause.heading, best.clause.body);
  var citation = best.s.citation === true;
  // weak 역할(목적·정의·전문·계약기간·완전합의) + 명시 인용 없음 → 자동확정 불가(최대 review)
  var weakGate = role.weak === true && !citation;

  var confirmed = false;
  if (!weakGate) {
    if (citation) confirmed = true;
    else if (best.s.score >= MatcherConfig.ABS_SCORE && best.s.normMatch) confirmed = true;
    else if (ranked.length >= 2 &&
      (best.s.score - ranked[1].s.score) >= MatcherConfig.MARGIN_HIGH &&
      best.s.score >= MatcherConfig.REVIEW_FLOOR) confirmed = true;
  }

  if (confirmed) {
    // 단일 신호 또는 단일 후보 → review 강등. 단, 명시 인용 확정은 유지.
    if (!citation && (best.s.signals < 2 || ranked.length === 1)) return "review";
    return "confirmed";
  }
  return "review"; // best.s.score >= REVIEW_FLOOR 이미 보장
}

// ── tier 근거 문자열 ─────────────────────────────────────────────
var _ROLE_LABEL = {
  purpose: "목적", definition: "정의", preamble: "전문",
  term: "계약기간", entire: "전체", general: "일반"
};
function _reasons(tier, ranked, check) {
  if (!ranked.length) return [];
  var best = ranked[0], s = best.s;
  if (tier === "none") return ["최고 점수 " + s.score.toFixed(1) + " — 임계 미달"];
  if (s.citation) return ["명시 인용 일치"];
  var role = ClauseRole.clauseRole(best.clause.heading, best.clause.body);
  var out = [];
  if (tier === "confirmed") {
    if (s.score >= MatcherConfig.ABS_SCORE && s.normMatch) out.push("절대점수·규범유형 일치 (" + s.score.toFixed(1) + ")");
    else if (ranked.length >= 2) out.push("복수 신호 상위 (점수차 " + (s.score - ranked[1].s.score).toFixed(1) + ")");
    else out.push("상위 매칭 (" + s.score.toFixed(1) + ")");
    return out;
  }
  // review 근거
  if (role.weak) out.push((_ROLE_LABEL[role.role] || role.role) + "·정의 조항 — 인용 없어 검토");
  if (ranked.length === 1) out.push("단일 후보 — 검토필요");
  if (s.signals < 2) out.push("단일 신호 — 검토필요");
  if (!out.length) out.push("검토 필요 (점수 " + s.score.toFixed(1) + ")");
  return out;
}

// ── 메인 ─────────────────────────────────────────────────────────
function analyze(clauses, docs, activeModules) {
  var model = buildModel(docs, activeModules);
  var results = [];
  var matches = [];
  var missing = [];

  model.checks.forEach(function (entry) {
    var cp = entry.cp;
    var scored = clauses.map(function (cl) {
      return { clause: cl, s: scoreClauseCheck(cl, entry, model) };
    }).sort(function (a, b) { return b.s.score - a.s.score; });

    var candidates = scored.filter(function (r) { return r.s.score >= MatcherConfig.REVIEW_FLOOR; });
    var tier = decideTier(candidates, cp);
    var top = scored[0] || null;
    var reasons = _reasons(tier, candidates.length ? candidates : scored, cp);
    var rankedTop = scored.slice(0, 3).map(function (r) {
      return { clauseIndex: r.clause.index, score: r.s.score };
    });

    results.push({
      cpId: cp.id,
      tier: tier,
      best: top ? { clauseIndex: top.clause.index, score: top.s.score, reasons: reasons } : null,
      ranked: rankedTop
    });

    if (tier !== "none" && top) {
      matches.push({
        cpId: cp.id,
        clauseIndex: top.clause.index,
        hits: {
          tier: tier, score: top.s.score, tfidf: top.s.tfidf, jaccard: top.s.jaccard,
          citation: top.s.citation, normMatch: top.s.normMatch, reasons: reasons
        }
      });
    }
    if (cp.absence_check && tier === "none") missing.push(cp);
  });

  return {
    checkpoints: model.checks.map(function (e) { return e.cp; }),
    results: results,
    matches: matches,   // 하위호환: tier!=="none" 인 best (app.js 소비)
    missing: missing    // 하위호환: absence_check && tier==="none"
  };
}

if (typeof module !== "undefined")
  module.exports = {
    detectType: detectType,
    suggestModules: suggestModules,
    activeCheckpoints: activeCheckpoints,
    normMatches: normMatches,
    checkText: checkText,
    clauseQuery: clauseQuery,
    buildModel: buildModel,
    citationHit: citationHit,
    titleBonus: titleBonus,
    scoreClauseCheck: scoreClauseCheck,
    decideTier: decideTier,
    analyze: analyze
  };
