"use strict";
/* 자동 마킹 태그 — 계약명·본문에서 계약의 세부 성격을 정규식으로 감지.
   유형(굵은 분류)과 독립. 유형 선택 부담 없이 세부 성격을 보조 배지로 표시한다.
   실데이터(회사 계약검토 리스트 6,631건) 빈도 기반으로 태그 선정.
   브라우저 전역 Tags + node require 겸용. */
var Tags = (function () {
  // 순서 = 표시 우선순위. re는 계약명(또는 본문)에 대해 test.
  var TAGS = [
    { id: "변경·합의서", re: /변경|합의서|연장|추가계약|재계약|부속약정|재체결/ },
    { id: "투자·펀드", re: /투자|펀드|출자|수익증권|사모|신탁(?!계약서 없음)|조합원|LP\b/ },
    { id: "담보·여신", re: /담보|대출|융자|여신|ABL|근질권|질권|채권양[수도]|리파이낸싱|저당/ },
    { id: "제휴·MOU", re: /제휴|MOU|업무협약|협약서/i },
    { id: "렌탈·임대", re: /렌탈|임대|임차|리스(?!크)/ },
    { id: "재보험", re: /재보험|출재|수재/ },
    { id: "이행보증", re: /이행보증|보증보험|지급보증|근질권/ },
    { id: "서비스이용", re: /서비스\s*이용|이용계약|구독|워크스페이스|workspace|saas/i },
    { id: "정보제공·데이터", re: /정보제공|데이터 제공|통계 지원|평가서비스|분석 서비스/ },
    { id: "라이선스·SW", re: /라이선스|라이센스|소프트웨어|솔루션 도입/ },
    // 해외·영문: 6글자 이상 연속 영문 토큰(약어 SI·GA·TM 등 제외)
    { id: "해외·영문", re: /[A-Za-z]{6,}/ }
  ];

  function detectTags(text) {
    var s = String(text || "");
    var out = [];
    for (var i = 0; i < TAGS.length; i++) {
      if (TAGS[i].re.test(s)) out.push(TAGS[i].id);
    }
    return out;
  }

  return { TAGS: TAGS, detectTags: detectTags };
})();

if (typeof module !== "undefined") module.exports = Tags;
