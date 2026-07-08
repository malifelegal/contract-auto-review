"use strict";
/* UI 오케스트레이션. segmenter.js·matcher.js·docx.js가 먼저 인라인되어 전역 함수 사용 가능 */

var CR = JSON.parse(document.getElementById("cr-data").textContent);
var state = { text: "", clauses: [], typeId: null, activeModules: [], result: null };

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function typeDoc(typeId) {
  for (var i = 0; i < CR.types.length; i++)
    if (CR.types[i].meta.type_id === typeId) return CR.types[i];
  return null;
}
function allChecksForType(typeId) {
  var doc = typeDoc(typeId);
  return CR.common.checks.concat(doc ? doc.checks : []);
}
function findCheck(id) {
  var all = allChecksForType(state.typeId);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}
function primarySource(cp) {
  return (cp.sources && cp.sources[0]) || null;
}

/* ---------- 증적 배지 ---------- */
function sourceBadgeInfo(src) {
  /* rank: 낮을수록 심각 — 행 배지는 전 source 중 최악을 표시 */
  switch (src.status) {
    case "quote_mismatch":
      return { cls: "mismatch", label: "문언 불일치", rank: 0 };
    case "missing":
      return { cls: "missing", label: "원문 미확인", rank: 0 };
    case "no_quote":
      return { cls: "ref", label: "참조", rank: 1 };
    case "quote_ok":
      return src.verified
        ? { cls: "verified", label: "원문확인", rank: 3 }
        : { cls: "unverified", label: "원문 미대조", rank: 2 };
    default:
      return { cls: "practice", label: "실무", rank: 4 };
  }
}
function evidenceBadgeInfo(cp) {
  var sources = cp.sources || [];
  if (!sources.length) return { cls: "practice", label: "실무" };
  var worst = null;
  sources.forEach(function (src) {
    var b = sourceBadgeInfo(src);
    if (!worst || b.rank < worst.rank) worst = b;
  });
  return worst;
}
function sourceBadgeHtml(src) {
  var b = sourceBadgeInfo(src);
  return '<span class="badge ' + b.cls + '">' + b.label + "</span>";
}
function evidenceCell(cp) {
  var src = primarySource(cp);
  var badge = evidenceBadgeInfo(cp);
  var lawText = src
    ? esc(src.law) + " " + esc(src.article) + (src.clause ? " " + esc(src.clause) : "")
    : "";
  return (lawText ? lawText + " " : "") + '<span class="badge ' + badge.cls + '">' + badge.label + "</span>" +
    (src ? sourceTypeBadgeHtml(src) : "");
}

/* ---------- coverage 배지 (계약 반영 축 — 증적 배지와 별개) ----------
   검토 보조 화법: 판정형("확정/미검출") 폐기. 짚음/확인권장/검토제안/기타. */
var COVERAGE_LABEL = {
  addressed: "✓ 반영",
  verify: "◑ 확인 권장",
  consider: "! 검토 제안",
  quiet: "·"
};
var COVERAGE_CLS = {
  addressed: "cov-addressed",
  verify: "cov-verify",
  consider: "cov-consider",
  quiet: "cov-quiet"
};
function coverageBadgeHtml(coverage) {
  if (!COVERAGE_LABEL[coverage] || coverage === "quiet") return "";
  return '<span class="badge ' + COVERAGE_CLS[coverage] + '">' + COVERAGE_LABEL[coverage] + "</span>";
}
/* source_type 배지 (법령 vs 자율규제 톤 구분) */
function sourceTypeBadgeHtml(src) {
  if (src && src.source_type === "self_regulation")
    return ' <span class="badge self-reg">자율규제</span>';
  return "";
}

/* ---------- 체크 카드 (조항별 보기·리포트 공용) ---------- */
function renderCheckCard(cp, hits) {
  var h = '<div class="cp-card"><h3><span class="sev sev-' + cp.severity + '" title="' +
    esc(cp.severity_basis || "") + '">' +
    esc(cp.severity) + "</span>" + esc(cp.id) + " <span class=\"norm-type\">" + esc(cp.norm_type) + "</span></h3>";
  h += '<p class="check-q">' + esc(cp.check) + "</p>";
  if (cp.severity_basis)
    h += '<p class="sev-basis">' + esc(cp.severity_basis) + "</p>";
  if (hits) {
    h += '<p class="hit">' + coverageBadgeHtml(hits.coverage) + " 관련 조항 — 점수 " + hits.score.toFixed(1) +
      ' <span class="reasons">' + esc((hits.reasons || []).join("; ")) + "</span></p>";
  }
  var src0 = primarySource(cp);
  if (src0 && src0.quote) {
    h += '<div class="quote-block"><p class="quote-label">원문 발췌</p><blockquote>“' +
      esc(src0.quote) + '”</blockquote></div>';
  }
  h += "<p>" + evidenceCell(cp) + "</p>";
  (cp.sources || []).forEach(function (src) {
    var label = esc(src.law) + " " + esc(src.article) + (src.clause ? " " + esc(src.clause) : "");
    h += '<details class="law"><summary>' + label + " " + sourceBadgeHtml(src) + sourceTypeBadgeHtml(src) + "</summary>";
    h += src.text ? "<pre>" + esc(src.text) + "</pre>" : "<p>원문 데이터 없음</p>";
    h += "</details>";
  });
  (cp.news || []).forEach(function (n) {
    h += '<details class="law"><summary>[동향] ' + esc(n.title) + " (" + esc(n.published_at) +
      ")</summary><p>" + esc(n.summary || "") + "</p></details>";
  });
  if (cp.note) h += '<p class="note">비고: ' + esc(cp.note) + "</p>";
  return h + "</div>";
}

/* ---------- 탭 ---------- */
document.querySelectorAll(".tab").forEach(function (btn) {
  btn.addEventListener("click", function () {
    if (btn.disabled) return;
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.remove("active"); });
    document.querySelectorAll(".pane").forEach(function (p) { p.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("pane-" + btn.dataset.tab).classList.add("active");
  });
});

/* ---------- 체크리스트 표 (주 탭) ---------- */
// 정렬 우선순위: 검토 제안 → 확인 권장 → 반영 → 기타(조용) → 미분석/비활성
var COVERAGE_RANK = { consider: 0, verify: 1, addressed: 2, quiet: 3 };
function resultFor(cp) {
  if (!state.result) return null;
  return state.result.results.filter(function (x) { return x.cpId === cp.id; })[0] || null;
}
function checkStatus(cp) {
  if (!state.result) return { cls: "", label: "—", coverage: null };
  var r = resultFor(cp);
  if (!r) return { cls: "", label: "—", coverage: null }; // 이번 분석에서 비활성 모듈 체크
  var cov = r.coverage;
  return { cls: COVERAGE_CLS[cov] || "", label: COVERAGE_LABEL[cov] || "", coverage: cov };
}

function renderModuleGuideBar(modules) {
  document.getElementById("checklist-modules").innerHTML = modules.map(function (m) {
    return '<span class="module-chip on">' + esc(m.name) + "</span>";
  }).join("");
}

function renderModuleFilterOptions(modules) {
  var sel = document.getElementById("filter-module");
  var prev = sel.value;
  var opts = ['<option value="">전체</option>'];
  modules.forEach(function (m) { opts.push('<option value="' + esc(m.id) + '">' + esc(m.name) + "</option>"); });
  opts.push('<option value="__none__">미분류</option>');
  sel.innerHTML = opts.join("");
  var stillExists = Array.prototype.some.call(sel.options, function (o) { return o.value === prev; });
  if (stillExists) sel.value = prev;
}

function renderChecklistRow(cp, st) {
  var rowCls = st.coverage === "consider" ? "row-consider" : "";
  var basis = cp.severity_basis || "";
  return '<tr class="cp-row ' + rowCls + '" data-id="' + esc(cp.id) + '">' +
    '<td class="match-cell ' + st.cls + '">' + esc(st.label) + "</td>" +
    "<td>" + esc(cp.id) + "</td>" +
    "<td>" + esc(cp.check) + "</td>" +
    '<td><span class="sev sev-' + cp.severity + '" title="' + esc(basis) + '">' + esc(cp.severity) + "</span>" +
    (basis ? '<span class="sev-basis-hint">' + esc(basis) + "</span>" : "") + "</td>" +
    "<td>" + esc(cp.norm_type) + "</td>" +
    "<td>" + evidenceCell(cp) + "</td>" +
    "</tr>" +
    '<tr class="cp-detail" hidden><td colspan="6"></td></tr>';
}

function renderDetail(cp) {
  var h = "";
  var src0 = primarySource(cp);
  if (src0 && src0.quote) {
    h += '<div class="quote-block"><p class="quote-label">원문 발췌</p><blockquote>“' +
      esc(src0.quote) + '”</blockquote></div>';
  }
  (cp.sources || []).forEach(function (src) {
    var label = esc(src.law) + " " + esc(src.article) + (src.clause ? " " + esc(src.clause) : "");
    h += '<details class="law"><summary>' + label + " " + sourceBadgeHtml(src) + sourceTypeBadgeHtml(src) + "</summary>";
    h += src.text ? "<pre>" + esc(src.text) + "</pre>" : "<p>원문 데이터 없음</p>";
    h += "</details>";
  });
  var r = resultFor(cp);
  if (r && r.tier !== "none" && r.best) {
    var clause = state.clauses[r.best.clauseIndex];
    var heading = clause ? clause.heading : ("조항#" + r.best.clauseIndex);
    h += '<div class="match-excerpt"><p class="hit">' + coverageBadgeHtml(r.coverage) + " " +
      esc(heading) + " — 원문 확인 권장 · 점수 " + r.best.score.toFixed(1) +
      '<br><span class="reasons">' + esc((r.best.reasons || []).join("; ")) + "</span></p>";
    h += "<pre>" + esc(clause ? clause.body : "") + "</pre>";
    if (r.ranked && r.ranked.length > 1) {
      h += '<p class="ranked-alt">다른 후보(점수순): ' + r.ranked.slice(1).map(function (rk) {
        var c = state.clauses[rk.clauseIndex];
        return esc(c ? c.heading : ("조항#" + rk.clauseIndex)) + " (" + rk.score.toFixed(1) + ")";
      }).join(", ") + "</p>";
    }
    h += "</div>";
  }
  if (cp.note) h += '<p class="note">비고: ' + esc(cp.note) + "</p>";
  return h || "<p>상세 정보 없음</p>";
}

function bindRowClicks() {
  document.querySelectorAll("#checklist-body tr.cp-row").forEach(function (tr) {
    tr.addEventListener("click", function () {
      var detail = tr.nextElementSibling;
      if (!detail || !detail.classList.contains("cp-detail")) return;
      var willOpen = detail.hidden;
      detail.hidden = !detail.hidden;
      tr.classList.toggle("expanded", !detail.hidden);
      if (willOpen && !detail.dataset.filled) {
        var cp = findCheck(tr.dataset.id);
        if (cp) {
          detail.querySelector("td").innerHTML = renderDetail(cp);
          detail.dataset.filled = "1";
        }
      }
    });
  });
}

function renderChecklist() {
  var typeId = document.getElementById("checklist-type").value;
  state.typeId = typeId;
  var doc = typeDoc(typeId);
  var allModules = (CR.common.meta.modules || []).concat(doc ? doc.meta.modules : []);
  renderModuleGuideBar(allModules);
  renderModuleFilterOptions(allModules);

  var base = allChecksForType(typeId);

  var modF = document.getElementById("filter-module").value;
  var sevF = document.getElementById("filter-severity").value;
  var matchF = document.getElementById("filter-match").value;
  var q = document.getElementById("filter-search").value.trim();

  function passFilter(cp, st) {
    if (modF) {
      if (modF === "__none__") { if (cp.module) return false; }
      else if (cp.module !== modF) return false;
    }
    if (sevF && cp.severity !== sevF) return false;
    // matchF: unmatched="검토 제안만"(consider) / matched="반영·확인만"(addressed·verify)
    if (matchF === "unmatched" && st.coverage !== "consider") return false;
    if (matchF === "matched" && st.coverage !== "addressed" && st.coverage !== "verify") return false;
    if (q) {
      var src = primarySource(cp);
      var hay = cp.check + " " + (src ? src.law + " " + src.article : "");
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  // coverage 우선(consider→verify→addressed→quiet→미분석), 그 안에서 score 내림차순
  var rows = base.map(function (cp) { return { cp: cp, st: checkStatus(cp) }; });
  if (state.result) {
    rows.sort(function (a, b) {
      var ra = COVERAGE_RANK[a.st.coverage]; if (ra === undefined) ra = 4;
      var rb = COVERAGE_RANK[b.st.coverage]; if (rb === undefined) rb = 4;
      if (ra !== rb) return ra - rb;
      var la = resultFor(a.cp), lb = resultFor(b.cp);
      var sa = la && la.best ? la.best.score : -1;
      var sb = lb && lb.best ? lb.best.score : -1;
      return sb - sa;
    });
  }
  rows = rows.filter(function (r) { return passFilter(r.cp, r.st); });

  document.getElementById("checklist-body").innerHTML =
    rows.map(function (r) { return renderChecklistRow(r.cp, r.st); }).join("") ||
    '<tr><td colspan="6" class="empty">조건에 맞는 항목 없음</td></tr>';

  bindRowClicks();
}

function initChecklistType() {
  var sel = document.getElementById("checklist-type");
  sel.innerHTML = CR.types.map(function (t) {
    return '<option value="' + esc(t.meta.type_id) + '">' + esc(t.meta.type_name) + "</option>";
  }).join("");
  sel.addEventListener("change", function () {
    state.typeId = sel.value;
    if (!document.getElementById("analyze-setup").hidden) renderScreening();
    renderChecklist();
  });
  state.typeId = sel.value;
}

["filter-module", "filter-severity", "filter-match"].forEach(function (id) {
  document.getElementById(id).addEventListener("change", renderChecklist);
});
document.getElementById("filter-search").addEventListener("input", renderChecklist);

/* ---------- 분석 모드: 입력 ---------- */
document.getElementById("docx-file").addEventListener("change", function (e) {
  var f = e.target.files[0];
  if (!f) return;
  f.arrayBuffer().then(extractDocxText).then(function (text) {
    document.getElementById("contract-text").value = text;
    document.getElementById("input-error").hidden = true;
  }).catch(function (err) {
    var el = document.getElementById("input-error");
    el.textContent = ".docx 파싱 실패(" + err.message + ") — Word에서 텍스트로 복사해 붙여넣으세요.";
    el.hidden = false;
  });
});

document.getElementById("btn-analyze").addEventListener("click", function () {
  state.text = document.getElementById("contract-text").value;
  if (!state.text.trim()) return;
  state.clauses = segmentContract(state.text);
  var ranked = detectType(state.text, CR.types);
  var sel = document.getElementById("checklist-type");
  if (ranked[0] && ranked[0].score > 0) sel.value = ranked[0].typeId;
  state.typeId = sel.value;
  renderScreening();
  renderChecklist();
  document.getElementById("analyze-setup").hidden = false;
});

/* ---------- 분석 모드: 모듈 스크리닝 ---------- */
function renderScreening() {
  var doc = typeDoc(document.getElementById("checklist-type").value);
  if (!doc) {
    document.getElementById("screening").innerHTML = "";
    state.activeModules = [];
    return;
  }
  var suggested = suggestModules(state.text, doc.meta.modules);
  state.activeModules = doc.meta.modules
    .filter(function (m) { return m.always_on || suggested.indexOf(m.id) !== -1; })
    .map(function (m) { return m.id; });
  document.getElementById("screening").innerHTML = doc.meta.modules.map(function (m) {
    if (m.always_on)
      return '<span class="module-chip on">' + esc(m.name) + " (기본)</span>";
    var on = state.activeModules.indexOf(m.id) !== -1;
    var sug = suggested.indexOf(m.id) !== -1;
    return '<label class="module-chip' + (on ? " on" : "") + (sug ? " suggested" : "") +
      '" data-mid="' + esc(m.id) + '" title="' + esc(m.screening_question || "") + '">' +
      esc(m.name) + (sug ? " ⚡본문 검출" : "") + "</label>";
  }).join("");
  document.querySelectorAll("#screening .module-chip[data-mid]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var mid = chip.dataset.mid;
      var i = state.activeModules.indexOf(mid);
      if (i === -1) state.activeModules.push(mid); else state.activeModules.splice(i, 1);
      chip.classList.toggle("on");
    });
  });
}

/* ---------- 분석 실행 ---------- */
document.getElementById("btn-run").addEventListener("click", function () {
  state.typeId = document.getElementById("checklist-type").value;
  var doc = typeDoc(state.typeId);
  var docs = [
    { checkpoints: CR.common.checks },
    { checkpoints: doc ? doc.checks : [] },
  ];
  state.result = analyze(state.clauses, docs, state.activeModules);
  renderClauses();
  renderChecklist();
  renderReport();
  document.getElementById("analyze-result").hidden = false;
  document.getElementById("clauses-empty").hidden = true;
  document.getElementById("report-tab").disabled = false;
  document.getElementById("input-panel").open = false;
  document.querySelector('.tab[data-tab="checklist"]').click();
});

/* ---------- 조항별 보기 (보조 탭) — 좌우대비 ---------- */
// 조항 하나에 대해: 좌 "반영된 검토항목"(그 조항이 best인 addressed) / 우 "추가 확인 제안"(verify).
// results를 best.clauseIndex로 역인덱싱하여 coverage별로 모음.
function _cpById(id) {
  var cps = state.result.checkpoints;
  for (var i = 0; i < cps.length; i++) if (cps[i].id === id) return cps[i];
  return null;
}
// 검토항목 1건 요약: 심각도(+근거 툴팁) · 질문 · reason · 근거.
function renderCompareItem(r) {
  var cp = _cpById(r.cpId);
  if (!cp) return "";
  var reasons = (r.best && r.best.reasons) || [];
  return '<div class="compare-item">' +
    '<div class="ci-head"><span class="sev sev-' + cp.severity + '" title="' + esc(cp.severity_basis || "") + '">' +
    esc(cp.severity) + "</span><span class=\"ci-id\">" + esc(cp.id) + "</span></div>" +
    '<p class="ci-q">' + esc(cp.check) + "</p>" +
    (reasons.length ? '<p class="ci-reason">' + esc(reasons.join("; ")) + "</p>" : "") +
    (cp.severity_basis ? '<p class="ci-basis">' + esc(cp.severity_basis) + "</p>" : "") +
    '<p class="ci-src">' + evidenceCell(cp) + "</p>" +
    "</div>";
}
function renderClauses() {
  // ci -> { addressed:[r...], verify:[r...] }
  var byClause = {};
  state.result.results.forEach(function (r) {
    if (!r.best || r.coverage === "quiet" || r.coverage === "consider") return;
    var ci = r.best.clauseIndex;
    var g = byClause[ci] || (byClause[ci] = { addressed: [], verify: [] });
    if (r.coverage === "addressed") g.addressed.push(r);
    else if (r.coverage === "verify") g.verify.push(r);
  });
  document.getElementById("clause-list").innerHTML = state.clauses.map(function (c) {
    var g = byClause[c.index] || { addressed: [], verify: [] };
    var parts = [];
    if (g.addressed.length) parts.push("반영 " + g.addressed.length);
    if (g.verify.length) parts.push("확인 " + g.verify.length);
    return '<div class="clause" data-ci="' + c.index + '"><strong>' + esc(c.heading) +
      '</strong><span class="cnt">' + esc(parts.join(" · ")) + "</span><pre>" +
      esc(c.body) + "</pre></div>";
  }).join("");
  document.querySelectorAll(".clause").forEach(function (el) {
    el.addEventListener("click", function () {
      document.querySelectorAll(".clause").forEach(function (x) { x.classList.remove("sel"); });
      el.classList.add("sel");
      var ci = Number(el.dataset.ci);
      var g = byClause[ci] || { addressed: [], verify: [] };
      var left = g.addressed.map(renderCompareItem).join("") ||
        '<p class="compare-empty">이 조항에서 반영으로 짚인 항목 없음</p>';
      var right = g.verify.map(renderCompareItem).join("") ||
        '<p class="compare-empty">추가 확인 제안 없음</p>';
      document.getElementById("mapping-detail").innerHTML =
        '<div class="clause-compare">' +
        '<div class="compare-col addressed-col"><h3><span class="badge cov-addressed">✓ 반영</span> 이 조항에서 반영된 검토항목</h3>' + left + "</div>" +
        '<div class="compare-col verify-col"><h3><span class="badge cov-verify">◑ 확인 권장</span> 추가 확인 제안</h3>' + right + "</div>" +
        "</div>";
    });
  });
}

/* ---------- 종합 리포트 (긍정-먼저 검토 워크시트) ----------
   실패 목록이 아니라 검토 진행 현황: 반영된 항목을 먼저·크게, 확인·검토 제안을 뒤에.
   판정형 어휘 금지 — 짚어진/반영/확인 권장/검토 제안 화법. */
function hashText(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "cr-" + (h >>> 0).toString(36);
}
var SEV_RANK = { "필수": 0, "권장": 1, "참고": 2 };
function _sevSort(a, b) {
  var ra = SEV_RANK[a.severity]; if (ra === undefined) ra = 3;
  var rb = SEV_RANK[b.severity]; if (rb === undefined) rb = 3;
  return ra - rb;
}
function _clauseHeading(idx) {
  var c = state.clauses[idx];
  return c ? c.heading : ("조항#" + idx);
}
function _signoff(cp, saved) {
  var ck = saved[cp.id] ? " checked" : "";
  return '<label class="signoff"><input type="checkbox" data-cp="' + esc(cp.id) + '"' + ck +
    "> 검토 완료 표시</label>";
}
function _reportTile(cov, n, label, sub) {
  return '<div class="tile tile-' + cov + '"><span class="tile-n">' + n + "</span>" +
    '<span class="tile-label">' + esc(label) + "</span>" +
    '<span class="tile-sub">' + esc(sub) + "</span></div>";
}
// 검토 제안(consider): 왜 봐야 하는지(severity_basis) + check 질문 + 근거 + sign-off.
function _considerItem(it, saved) {
  var cp = it.cp;
  return '<div class="report-item consider-item">' +
    '<div class="ri-head"><span class="sev sev-' + cp.severity + '" title="' +
    esc(cp.severity_basis || "") + '">' + esc(cp.severity) + "</span>" +
    '<span class="ri-q">' + esc(cp.check) + "</span></div>" +
    (cp.severity_basis ? '<p class="ri-why">왜 봐야 하는지: ' + esc(cp.severity_basis) + "</p>" : "") +
    '<p class="ri-src">근거 ' + evidenceCell(cp) + "</p>" +
    _signoff(cp, saved) + "</div>";
}
// 확인 권장(verify): 관련 조항·이유 + sign-off.
function _verifyItem(it, saved) {
  var cp = it.cp, res = it.res;
  var loc = res.best ? _clauseHeading(res.best.clauseIndex) : "";
  var reasons = (res.best && res.best.reasons) || [];
  return '<div class="report-item verify-item">' +
    '<div class="ri-head"><span class="sev sev-' + cp.severity + '" title="' +
    esc(cp.severity_basis || "") + '">' + esc(cp.severity) + "</span>" +
    '<span class="ri-q">' + esc(cp.check) + "</span></div>" +
    (loc ? '<p class="ri-loc">관련 조항: ' + esc(loc) + "</p>" : "") +
    (reasons.length ? '<p class="ri-reason">' + esc(reasons.join("; ")) + "</p>" : "") +
    _signoff(cp, saved) + "</div>";
}
// 짚어진 항목(addressed): 어느 조항에서 반영됐는지 — 긍정 정보 노출.
function _addressedItem(it) {
  var cp = it.cp, res = it.res;
  var loc = res.best ? _clauseHeading(res.best.clauseIndex) : "";
  var reasons = (res.best && res.best.reasons) || [];
  return '<div class="report-item addressed-item">' +
    '<div class="ri-head"><span class="badge cov-addressed">✓ 반영</span>' +
    '<span class="ri-q">' + esc(cp.check) + "</span></div>" +
    (loc ? '<p class="ri-loc">' + esc(loc) + "에서 반영</p>" : "") +
    (reasons.length ? '<p class="ri-reason">' + esc(reasons.join("; ")) + "</p>" : "") +
    "</div>";
}
// 조항별 검토 현황(선택): 반영/확인 건수 요약.
function _clauseSummarySection(addressed, verify) {
  var byClause = {};
  addressed.concat(verify).forEach(function (it) {
    if (!it.res.best) return;
    var ci = it.res.best.clauseIndex;
    var g = byClause[ci] || (byClause[ci] = { a: 0, v: 0 });
    if (it.res.coverage === "addressed") g.a++; else g.v++;
  });
  var rows = state.clauses.map(function (c) {
    var g = byClause[c.index];
    if (!g) return "";
    var parts = [];
    if (g.a) parts.push("반영 " + g.a);
    if (g.v) parts.push("확인 " + g.v);
    return '<li><strong>' + esc(c.heading) + '</strong> <span class="cs-cnt">' +
      esc(parts.join(" · ")) + "</span></li>";
  }).filter(Boolean);
  if (!rows.length) return "";
  return '<details class="report-sec"><summary>조항별 검토 현황</summary>' +
    '<ul class="clause-summary">' + rows.join("") + "</ul></details>";
}
function renderReport() {
  var key = hashText(state.text);
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
  var r = state.result;

  var addressed = [], verify = [], consider = [];
  r.results.forEach(function (res) {
    var cp = _cpById(res.cpId);
    if (!cp) return;
    var it = { cp: cp, res: res, severity: cp.severity };
    if (res.coverage === "addressed") addressed.push(it);
    else if (res.coverage === "verify") verify.push(it);
    else if (res.coverage === "consider") consider.push(it);
  });
  addressed.sort(_sevSort); verify.sort(_sevSort); consider.sort(_sevSort);

  var h = "<h2>검토 워크시트</h2>";
  h += '<p class="report-intro">이 계약서에서 아래와 같이 검토됨. 반영된 항목을 먼저 두고, 확인·검토 제안을 정리함. 각 항목은 검토 후 “검토 완료 표시”로 남길 수 있음.</p>';

  // 1) 긍정 먼저 요약 타일
  h += '<div class="report-tiles">' +
    _reportTile("addressed", addressed.length, "짚어진 항목", "계약서가 반영함") +
    _reportTile("verify", verify.length, "확인 권장", "관련 조항 있음 · 문구 확인") +
    _reportTile("consider", consider.length, "검토 제안", "필요한 계약인지 검토") +
    "</div>";

  // 2) 검토 제안 — 심각도순 · 접힘(필수 표면, 권장 접힘)
  h += '<section class="report-sec-block">';
  h += "<h3>검토 제안 (" + consider.length + ")</h3>";
  if (!consider.length) {
    h += '<p class="report-none">검토 제안 항목 없음 — 필수·권장 항목이 모두 관련 조항에 닿았음.</p>';
  } else {
    h += '<p class="sec-hint">이 항목이 계약서에서 보이지 않음 — 빠졌다는 뜻이 아니라, 필요한 계약인지 검토 제안.</p>';
    var must = consider.filter(function (it) { return it.severity === "필수"; });
    var rec = consider.filter(function (it) { return it.severity !== "필수"; });
    h += must.map(function (it) { return _considerItem(it, saved); }).join("");
    if (rec.length) {
      h += '<details class="report-more"><summary>권장 검토 제안 ' + rec.length + "건 펼치기</summary>" +
        rec.map(function (it) { return _considerItem(it, saved); }).join("") + "</details>";
    }
  }
  h += "</section>";

  // 3) 확인 권장
  h += '<details class="report-sec" open><summary>확인 권장 ' + verify.length +
    " — 관련 조항 있음, 문구 확인 권함</summary>";
  h += verify.map(function (it) { return _verifyItem(it, saved); }).join("") ||
    '<p class="report-none">확인 권장 항목 없음.</p>';
  h += "</details>";

  // 4) 짚어진 항목
  h += '<details class="report-sec"><summary>짚어진 항목 ' + addressed.length +
    " — 계약서가 반영한 항목</summary>";
  h += addressed.map(_addressedItem).join("") ||
    '<p class="report-none">아직 반영으로 짚인 항목 없음.</p>';
  h += "</details>";

  // 5) 조항별 검토 현황(선택)
  h += _clauseSummarySection(addressed, verify);

  var body = document.getElementById("report-body");
  body.innerHTML = h;
  body.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
    cb.addEventListener("change", function () {
      saved[cb.dataset.cp] = cb.checked;
      localStorage.setItem(key, JSON.stringify(saved));
    });
  });
}
// 인쇄 시 접힌 섹션도 펼쳐 요약 타일·검토 제안·확인 권장이 모두 나오게.
window.addEventListener("beforeprint", function () {
  document.querySelectorAll("#report-body details").forEach(function (d) {
    if (!d.open) { d.dataset.wasClosed = "1"; d.open = true; }
  });
});
window.addEventListener("afterprint", function () {
  document.querySelectorAll("#report-body details[data-was-closed]").forEach(function (d) {
    d.open = false; d.removeAttribute("data-was-closed");
  });
});

initChecklistType();
renderChecklist();
