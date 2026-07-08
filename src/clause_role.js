"use strict";
/* 조항역할(role)·규범유형(norm type)·조 표제(title) 파싱.
   원본 이식 출처:
   - comp_matching_auto/matcher/clause_role.py — "역할 기반 자동확정 게이트" 아이디어 차용.
     단, 원본은 사규(내부규정) 도메인 역할(definition/internal_admin/committee_ops/substantive)이고
     본 파일은 계약서 도메인 역할(purpose/definition/preamble/term/entire/general)로 재정의함.
   - comp_matching_auto/matcher/preprocess.py의 classify_norm_type() regex를 JS로 이식(우선순위:
     금지 > 의무 > 권한 > 선언 동일 유지). */

var ClauseRole = (function () {

  // segmenter.js가 생성하는 특수 heading("(전문)"=조항 분리 실패 시 전체 텍스트 앞부분,
  // "(전체)"=조항이 1개 이하라 분리 자체를 포기한 경우)은 표제 파싱 대상이 아님.
  var SPECIAL_HEADINGS = { "(전문)": "preamble", "(전체)": "entire" };

  // 표제(괄호 안 텍스트) 기반 역할 판정 — 표제 우선.
  var TITLE_ROLE_RULES = [
    { re: /목적/, role: "purpose", weak: true },
    { re: /정의|용어/, role: "definition", weak: true },
    { re: /계약\s*기간|유효\s*기간/, role: "term", weak: true },
    { re: /완전\s*합의|완전한\s*합의/, role: "general", weak: true },
    // 통지·비용부담은 실체 규제의무(예: 개인정보 유출 통지)일 수 있어 weak 게이트 대상 아님.
    // 표제 무매치 → general/weak=false 로 판정되게 두어 tier 게이트에서 자동확정 가능하게 함.
  ];

  // 표제가 없을 때만 본문 앞부분으로 보조 판정(comp preprocess.py declaration 정규식 차용).
  var BODY_ROLE_RULES = [
    { re: /목적으로\s*한다|정함을\s*목적/, role: "purpose", weak: true },
    { re: /[을를]\s*말한다|이라\s*한다|이라\s*함은/, role: "definition", weak: true },
    { re: /계약\s*기간은|유효\s*기간은/, role: "term", weak: true },
  ];

  function parseTitle(heading) {
    var h = String(heading || "").trim();
    if (h === "(전문)" || h === "(전체)") return "";
    var m = h.match(/[\(（]([^\)）]*)[\)）]/);
    if (!m) return "";
    return m[1].trim();
  }

  function clauseRole(heading, body) {
    var h = String(heading || "").trim();
    if (Object.prototype.hasOwnProperty.call(SPECIAL_HEADINGS, h)) {
      return { role: SPECIAL_HEADINGS[h], weak: true };
    }
    var title = parseTitle(heading);
    var i;
    if (title) {
      for (i = 0; i < TITLE_ROLE_RULES.length; i++) {
        if (TITLE_ROLE_RULES[i].re.test(title)) {
          return { role: TITLE_ROLE_RULES[i].role, weak: TITLE_ROLE_RULES[i].weak };
        }
      }
      return { role: "general", weak: false };
    }
    var b = String(body || "");
    for (i = 0; i < BODY_ROLE_RULES.length; i++) {
      if (BODY_ROLE_RULES[i].re.test(b)) {
        return { role: BODY_ROLE_RULES[i].role, weak: BODY_ROLE_RULES[i].weak };
      }
    }
    return { role: "general", weak: false };
  }

  // 규범유형: 금지 > 의무 > 권한 > 선언 (comp preprocess.classify_norm_type 이식, 라벨만 국문 그대로)
  var PROHIBITION_RE = [
    /아니\s*된다/, /하여서는\s*아니/, /금지/,
    /할\s*수\s*없다/, /하지\s*못한다/, /해서는\s*안/
  ];
  var OBLIGATION_RE = [/하여야\s*한다/, /해야\s*한다/, /의무/];
  var RIGHT_RE = [/할\s*수\s*있다/, /권한/];
  var DECLARATION_RE = [/본다/, /간주/, /추정/, /정의한다/, /말한다/];

  function _any(text, list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].test(text)) return true;
    }
    return false;
  }

  function normType(text) {
    var t = String(text || "");
    if (!t.trim()) return null;
    if (_any(t, PROHIBITION_RE)) return "금지";
    if (_any(t, OBLIGATION_RE)) return "의무";
    if (_any(t, RIGHT_RE)) return "권한";
    if (_any(t, DECLARATION_RE)) return "선언";
    return null;
  }

  return { parseTitle: parseTitle, clauseRole: clauseRole, normType: normType };
})();

if (typeof module !== "undefined") module.exports = ClauseRole;
