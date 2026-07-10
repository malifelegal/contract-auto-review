/* 04b-cfb: OLE 복합문서(CFB) 리더 — .doc·.hwp(5.0)가 공유하는 컨테이너 포맷.
   스트림을 이름으로 꺼낸다(flat lookup; 스토리지 계층은 무시하되 스트림 시작섹터·크기는 절대값이라 무관).
   참조: [MS-CFB]. */
(function () {
  var END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;

  function read(buf) {
    var u8 = new Uint8Array(buf);
    var dv = new DataView(buf);
    var u16 = function (o) { return dv.getUint16(o, true); };
    var u32 = function (o) { return dv.getUint32(o, true); };

    if (u32(0) !== 0xE011CFD0 || u32(4) !== 0xE11AB1A1)
      throw new Error('CFB 시그니처 아님 (OLE 복합문서가 아님)');

    var secSize = 1 << u16(30);
    var miniSize = 1 << u16(32);
    var numFatSect = u32(44);
    var dirStart = u32(48);
    var miniCutoff = u32(56);
    var miniFatStart = u32(60);
    var numMiniFat = u32(64);
    var difatStart = u32(68);
    var secOff = function (sid) { return (sid + 1) * secSize; };

    var fatSectors = [];
    for (var i = 0; i < 109 && fatSectors.length < numFatSect; i++) {
      var sid = u32(76 + i * 4);
      if (sid === FREE || sid === END) break;
      fatSectors.push(sid);
    }
    var ds = difatStart, g = 0;
    while (ds !== END && ds !== FREE && fatSectors.length < numFatSect && g++ < 100000) {
      var base = secOff(ds), per = (secSize / 4) - 1;
      for (var j = 0; j < per && fatSectors.length < numFatSect; j++) {
        var s = u32(base + j * 4);
        if (s === FREE || s === END) break;
        fatSectors.push(s);
      }
      ds = u32(base + secSize - 4);
    }

    var fat = [];
    for (var f = 0; f < fatSectors.length; f++) {
      var o = secOff(fatSectors[f]);
      for (var k = 0; k < secSize / 4; k++) fat.push(u32(o + k * 4));
    }

    function chain(start, fatArr, unit, offFn) {
      var parts = [], total = 0, sid = start, gg = 0;
      while (sid !== END && sid !== FREE && sid < fatArr.length && gg++ < 5000000) {
        var off = offFn(sid);
        parts.push(u8.subarray(off, off + unit));
        total += unit;
        sid = fatArr[sid];
      }
      var out = new Uint8Array(total), p = 0;
      for (var x = 0; x < parts.length; x++) { out.set(parts[x], p); p += parts[x].length; }
      return out;
    }

    var dirBytes = chain(dirStart, fat, secSize, secOff);
    var ddv = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
    var entries = [], root = null;
    var nEnt = Math.floor(dirBytes.length / 128);
    for (var e = 0; e < nEnt; e++) {
      var b = e * 128;
      var nameLen = ddv.getUint16(b + 64, true);
      if (!nameLen) continue;
      var name = '';
      for (var c = 0; c < nameLen / 2 - 1; c++) {
        var ch = ddv.getUint16(b + c * 2, true);
        if (ch) name += String.fromCharCode(ch);
      }
      var ent = { name: name, type: dirBytes[b + 66], start: ddv.getUint32(b + 116, true), size: ddv.getUint32(b + 120, true) };
      entries.push(ent);
      if (ent.type === 5) root = ent;
    }

    var miniFat = [];
    if (numMiniFat) {
      var mfb = chain(miniFatStart, fat, secSize, secOff);
      var mdv = new DataView(mfb.buffer, mfb.byteOffset, mfb.byteLength);
      for (var mi = 0; mi < mfb.length / 4; mi++) miniFat.push(mdv.getUint32(mi * 4, true));
    }
    var miniStream = root ? chain(root.start, fat, secSize, secOff) : new Uint8Array(0);

    function readEntry(entry) {
      if (entry.size >= miniCutoff)
        return chain(entry.start, fat, secSize, secOff).subarray(0, entry.size);
      var parts = [], total = 0, sid = entry.start, gg = 0;
      while (sid !== END && sid !== FREE && sid < miniFat.length && gg++ < 5000000) {
        var off = sid * miniSize;
        parts.push(miniStream.subarray(off, off + miniSize));
        total += miniSize;
        sid = miniFat[sid];
      }
      var out = new Uint8Array(total), p = 0;
      for (var x = 0; x < parts.length; x++) { out.set(parts[x], p); p += parts[x].length; }
      return out.subarray(0, entry.size);
    }

    return {
      names: entries.filter(function (x) { return x.type === 2; }).map(function (x) { return x.name; }),
      stream: function (name) {
        for (var i = 0; i < entries.length; i++)
          if (entries[i].name === name && entries[i].type === 2) return readEntry(entries[i]);
        return null;
      },
      streamsMatching: function (re) {
        var r = [];
        for (var i = 0; i < entries.length; i++)
          if (entries[i].type === 2 && re.test(entries[i].name)) r.push(entries[i].name);
        return r;
      }
    };
  }

  PF.cfb = { read: read };
})();
