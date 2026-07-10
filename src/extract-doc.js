/* 06-extract-doc: 구형 .doc (Word 97-2003 바이너리) 텍스트 추출.
   CFB 컨테이너(PF.cfb) → WordDocument/Table 스트림 → FIB fcClx → piece table(clx)로
   본문 조각을 순서대로 디코드(UTF-16LE 또는 cp1252). 한글은 비압축 UTF-16LE piece로 저장됨.
   참조: [MS-DOC]. */
(function () {
  function makeDecoder(label, fallback) {
    try { return new TextDecoder(label); }
    catch (e) { return new TextDecoder(fallback || 'utf-8'); }
  }

  function extractDoc(buf) {
    return new Promise(function (resolve, reject) {
      try { resolve(parse(buf)); }
      catch (e) { reject(e); }
    });
  }

  function parse(buf) {
    var cfb = PF.cfb.read(buf);
    var wdBytes = cfb.stream('WordDocument');
    if (!wdBytes) throw new Error('WordDocument 스트림 없음 — Word .doc가 아님');
    var wdv = new DataView(wdBytes.buffer, wdBytes.byteOffset, wdBytes.byteLength);

    var flags = wdv.getUint16(10, true);
    var tblName = (flags & 0x0200) ? '1Table' : '0Table';
    var tbl = cfb.stream(tblName) || cfb.stream('1Table') || cfb.stream('0Table');
    if (!tbl) throw new Error('Table 스트림 없음');
    var tdv = new DataView(tbl.buffer, tbl.byteOffset, tbl.byteLength);

    // 가변 길이 FIB 구간을 걸어 fcClx(쌍 index 33) 위치 산출
    var p0 = 32;
    var csw = wdv.getUint16(p0, true);
    var p1 = p0 + 2 + csw * 2;
    var cslw = wdv.getUint16(p1, true);
    var p2 = p1 + 2 + cslw * 4;
    var fcLcbBase = p2 + 2;
    var fcClx = wdv.getUint32(fcLcbBase + 33 * 8, true);
    var lcbClx = wdv.getUint32(fcLcbBase + 33 * 8 + 4, true);

    var decU16 = makeDecoder('utf-16le');
    var dec8 = makeDecoder('windows-1252', 'latin1');

    if (lcbClx && fcClx + lcbClx <= tbl.length) {
      var text = parseClx(tbl, tdv, fcClx, lcbClx, wdBytes, decU16, dec8);
      if (text && text.length) return cleanup(text);
    }
    return cleanup(decU16.decode(wdBytes.subarray(0x200 < wdBytes.length ? 0x200 : 0)));
  }

  function parseClx(tbl, tdv, fcClx, lcbClx, wdBytes, decU16, dec8) {
    var pos = fcClx, end = fcClx + lcbClx;
    while (pos < end && tbl[pos] === 0x01) {
      var cb = tdv.getUint16(pos + 1, true);
      pos += 3 + cb;
    }
    if (pos >= end || tbl[pos] !== 0x02) throw new Error('piece table(Pcdt) 미발견');
    var lcbPlc = tdv.getUint32(pos + 1, true);
    var plc = pos + 5;
    var n = Math.floor((lcbPlc - 4) / 12);
    if (n <= 0) return '';
    var cps = [];
    for (var i = 0; i <= n; i++) cps.push(tdv.getUint32(plc + i * 4, true));
    var pcd = plc + (n + 1) * 4;
    var text = '';
    for (var pcIdx = 0; pcIdx < n; pcIdx++) {
      var fc = tdv.getUint32(pcd + pcIdx * 8 + 2, true);
      var compressed = (fc & 0x40000000) !== 0;
      var realFc = fc & 0x3FFFFFFF;
      var nChars = cps[pcIdx + 1] - cps[pcIdx];
      if (nChars <= 0) continue;
      if (compressed) {
        var o = realFc >> 1;
        text += dec8.decode(wdBytes.subarray(o, o + nChars));
      } else {
        text += decU16.decode(wdBytes.subarray(realFc, realFc + nChars * 2));
      }
    }
    return text;
  }

  function cleanup(text) {
    return text
      .replace(/\x13[^\x14\x15]*\x14/g, '')
      .replace(/[\x13\x14\x15]/g, '')
      .replace(/\x07/g, '\t')
      .replace(/[\x0B\x0C]/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\x00-\x08\x0E-\x1F]/g, '')
      .replace(/￿+/g, '');
  }

  PF.extractDoc = extractDoc;
})();
