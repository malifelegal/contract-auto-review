/* 05-extract-pdf: pdf.js 텍스트 추출.
   워커 전략: 내장 워커 소스(text/plain 블록) → Blob URL 워커. 실패 시 fake worker(메인 스레드) 폴백.
   file://에서 외부 워커 파일을 로드할 수 없으므로 두 경로 모두 네트워크 무의존. */
(function () {
  var workerReady = false;
  var workerMode = 'none';

  function setupWorker() {
    if (workerReady) return workerMode;
    var el = document.getElementById('pdfjs-worker-src');
    if (!el || !window.pdfjsLib) { workerMode = 'unavailable'; workerReady = true; return workerMode; }
    var src = el.textContent;
    try {
      var blob = new Blob([src], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      pdfjsLib.GlobalWorkerOptions.workerSrc = url;
      workerMode = 'blob';
    } catch (e) {
      try {
        /* fake worker: 워커 소스를 메인 스레드에서 평가 → window.pdfjsWorker 등록됨.
           pdf.js는 GlobalWorkerOptions.workerSrc가 없고 globalThis.pdfjsWorker가 있으면
           네트워크 fetch 없이 메인 스레드 fake worker로 동작한다. */
        (0, eval)(src);
        workerMode = 'fake';
      } catch (e2) {
        console.error('pdf.js 워커 초기화 실패', e2);
        workerMode = 'failed';
      }
    }
    workerReady = true;
    return workerMode;
  }

  /* 줄 구조 복원. 개행 기준을 폰트 크기에 비례시킴 — 종전 고정 임계(2pt)는 HWP/Word 변환
     PDF에서 같은 줄 내 조각의 미세한 y 변동에도 개행을 삽입해 줄이 잘게 쪼개졌음.
     |Δy| > 0.6×폰트크기일 때만 실제 줄바꿈으로 처리하고 hasEOL 중복 개행은 제거. */
  function itemsToText(items) {
    var out = '';
    var lastY = null, lastEndX = null, lastH = 12;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var tr = it.transform;
      var y = tr ? tr[5] : null;
      var h = tr ? (Math.abs(tr[0]) || Math.abs(tr[3]) || lastH) : lastH;
      if (h > 1) lastH = h;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 0.6 * lastH) {
        out += '\n';
      } else if (lastEndX !== null && tr && tr[4] - lastEndX > 0.5 * lastH &&
                 out && out[out.length - 1] !== ' ' && out[out.length - 1] !== '\n') {
        out += ' '; // 같은 줄에서 글자폭 절반 이상 벌어지면 공백 (단어 붙음 방지)
      }
      out += it.str;
      if (y !== null) lastY = y;
      lastEndX = (tr && typeof it.width === 'number') ? tr[4] + it.width : null;
    }
    return out;
  }

  function pageText(page) {
    return page.getTextContent().then(function (tc) {
      return itemsToText(tc.items);
    });
  }

  function extractPdf(arrayBuffer) {
    var mode = setupWorker();
    if (mode === 'unavailable' || mode === 'failed')
      return Promise.reject(new Error('pdf.js 사용 불가 (워커 모드: ' + mode + ')'));
    return pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise
      .then(function (doc) {
        var chain = Promise.resolve('');
        var total = doc.numPages;
        for (var p = 1; p <= total; p++) {
          (function (pageNum) {
            chain = chain.then(function (acc) {
              return doc.getPage(pageNum).then(pageText).then(function (t) {
                return acc + t + '\n\n';
              });
            });
          })(p);
        }
        return chain.then(function (text) {
          doc.destroy();
          return text;
        });
      });
  }

  PF.extractPdf = extractPdf;
  PF._pdfItemsToText = itemsToText; // 테스트용
  PF.pdfWorkerMode = function () { setupWorker(); return workerMode; };
})();
