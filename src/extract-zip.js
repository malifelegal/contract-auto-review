/* 06-extract-zip: docx·hwpx 텍스트 추출 (JSZip + DOMParser).
   둘 다 zip+XML 구조라 공통 워커(텍스트 노드 수집기) 하나로 처리.
   docx: word/document.xml (w:p/w:t/w:br/w:tab), hwpx: Contents/sectionN.xml (hp:p/hp:t) */
(function () {

  /* XML 서브트리에서 단락 구조를 보존하며 텍스트 수집.
     localName 기준이라 w:/hp: 네임스페이스 모두 동작. */
  function collectText(node, out) {
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) continue; // 텍스트 노드는 't' 요소 단위로만 수집
      if (c.nodeType !== 1) continue;
      var ln = c.localName;
      if (ln === 't') out.text += c.textContent;
      else if (ln === 'tab') out.text += '\t';
      else if (ln === 'br' || ln === 'cr' || ln === 'lineBreak') out.text += '\n';
      else if (ln === 'p') { collectText(c, out); out.text += '\n'; }
      else if (ln === 'tc') { collectText(c, out); out.text += '\t'; }
      else collectText(c, out);
    }
  }

  function xmlToText(xmlString) {
    var doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length)
      throw new Error('XML 파싱 오류');
    var out = { text: '' };
    collectText(doc.documentElement, out);
    return out.text;
  }

  function extractDocx(arrayBuffer) {
    return JSZip.loadAsync(arrayBuffer).then(function (zip) {
      var f = zip.file('word/document.xml');
      if (!f) throw new Error('docx 형식 아님 (word/document.xml 없음)');
      return f.async('string');
    }).then(xmlToText);
  }

  function extractHwpx(arrayBuffer) {
    return JSZip.loadAsync(arrayBuffer).then(function (zip) {
      var sections = [];
      zip.forEach(function (path) {
        if (/^Contents\/section\d+\.xml$/.test(path)) sections.push(path);
      });
      if (!sections.length) throw new Error('hwpx 형식 아님 (Contents/sectionN.xml 없음)');
      sections.sort(function (a, b) {
        return parseInt(a.match(/(\d+)/)[1], 10) - parseInt(b.match(/(\d+)/)[1], 10);
      });
      var chain = Promise.resolve('');
      for (var i = 0; i < sections.length; i++) {
        (function (path) {
          chain = chain.then(function (acc) {
            return zip.file(path).async('string').then(function (xml) {
              return acc + xmlToText(xml) + '\n';
            });
          });
        })(sections[i]);
      }
      return chain;
    });
  }

  PF.extractDocx = extractDocx;
  PF.extractHwpx = extractHwpx;
  PF._xmlToText = xmlToText;
})();
