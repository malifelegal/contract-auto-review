"use strict";
/* 파일 → 텍스트 통합 디스패처. 확장자로 적절한 추출기 선택.
   지원: .docx .hwpx (zip) · .pdf (pdf.js) · .doc (CFB) · .hwp (CFB+deflate).
   스캔 PDF·암호/구형 hwp·.doc 일부는 추출 실패 가능 → 호출측이 붙여넣기로 안내. */
function extractFileText(file) {
  var name = (file && file.name ? file.name : "").toLowerCase();
  var ext = name.slice(name.lastIndexOf(".") + 1);
  return file.arrayBuffer().then(function (buf) {
    switch (ext) {
      case "docx": return PF.extractDocx(buf);
      case "hwpx": return PF.extractHwpx(buf);
      case "pdf":  return PF.extractPdf(buf);
      case "doc":  return PF.extractDoc(buf);
      case "hwp":  return PF.extractHwp(buf);
      default:
        return Promise.reject(new Error("지원하지 않는 형식(." + ext + ") — docx·pdf·doc·hwp·hwpx만 지원"));
    }
  });
}

if (typeof module !== "undefined") module.exports = { extractFileText: extractFileText };
