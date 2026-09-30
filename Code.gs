// Google Apps Script: paste into Extensions > Apps Script of your Google Sheet.
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(d.type) || ss.insertSheet(d.type);
    if (sh.getLastRow() === 0) sh.appendRow(["Timestamp", "Inputs (JSON)", "Result (JSON)"]);
    sh.appendRow([d.timestamp, JSON.stringify(d.inputs), JSON.stringify(d.result)]);
    return ContentService.createTextOutput(JSON.stringify({ok: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
