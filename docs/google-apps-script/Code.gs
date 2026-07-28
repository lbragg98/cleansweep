const SPREADSHEET_ID = '1SyqwCcKwtTbKlJD6HC60h7Be5GcChiGE_T02fzli-JQ';

const SHEETS = {
  Inspections: ['Inspection ID','Business Date','Floor Number','Area','Daypart','Manager','Started At','Submitted At','Total Questions','Passed','Failed','Not Applicable','Compliance Score','Manager Initials','Notes'],
  Responses: ['Inspection ID','Business Date','Floor Number','Area','Daypart','Question ID','Category','Question','Result','Comment','Answered At'],
  'Corrective Actions': ['Inspection ID','Question ID','Question','Issue','Corrective Action','Corrected By','Corrected Immediately','Follow-Up Required','Follow-Up Owner','Follow-Up Due','Status','Notes'],
  'Daily Summary': ['Date','Floor Number','Area','Daypart','Inspection completed','Manager','Submitted time','Compliance score','Failed item count','Corrective actions still open']
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    if (!e || !e.postData || !e.postData.contents) throw new Error('Request body is required.');
    const body = JSON.parse(e.postData.contents);
    validate(body);
    const ss = getSpreadsheet();
    const id = Utilities.getUuid();
    const now = new Date();
    const items = body.responses || {};
    const actions = body.actions || {};
    const responseRows = Object.keys(items).map(function (questionId) { const r = items[questionId] || {}; return [id, body.businessDate, body.floorNumber, body.area, body.daypart, questionId, '', '', r.result || '', r.comment || '', now]; });
    const actionRows = Object.keys(actions).map(function (questionId) { const a = actions[questionId] || {}; return [id, questionId, '', a.issue || '', a.action || '', a.correctedBy || '', a.correctedImmediately || false, a.followUpRequired || false, a.followUpOwner || '', a.followUpDue || '', a.followUpRequired ? 'Open' : 'Closed', a.notes || '']; });
    append('Inspections', [id, body.businessDate, body.floorNumber, body.area, body.daypart, body.manager, body.startedAt, now, Object.keys(items).length, 0, 0, 0, 0, body.managerInitials || '', body.notes || '']);
    if (responseRows.length) appendMany('Responses', responseRows);
    if (actionRows.length) appendMany('Corrective Actions', actionRows);
    return json({ success: true, inspectionId: id });
  } catch (error) { return json({ success: false, error: error.message || 'Unable to save inspection.' }); }
  finally { try { lock.releaseLock(); } catch (ignored) {} }
}

function validate(body) { ['businessDate','floorNumber','manager','area','daypart','startedAt','responses'].forEach(function (key) { if (body[key] === undefined || body[key] === null || body[key] === '') throw new Error('Missing required field: ' + key); }); if (!['Bar','Beverage Stations'].includes(body.area)) throw new Error('Invalid area.'); }
function getSpreadsheet() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function append(tab, row) { getSpreadsheet().getSheetByName(tab).appendRow(row); }
function appendMany(tab, rows) { const sheet = getSpreadsheet().getSheetByName(tab); sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows); }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function setupSpreadsheet() { const ss = getSpreadsheet(); Object.keys(SHEETS).forEach(function (name) { let sheet = ss.getSheetByName(name) || ss.insertSheet(name); if (sheet.getLastRow() === 0) sheet.appendRow(SHEETS[name]); sheet.setFrozenRows(1); sheet.getRange(1,1,1,SHEETS[name].length).setFontWeight('bold').setBackground('#07192d').setFontColor('#ffffff'); sheet.autoResizeColumns(1,SHEETS[name].length); }); ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'updateDailySummary'; }).slice(1).forEach(function (t) { ScriptApp.deleteTrigger(t); }); if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'updateDailySummary'; })) ScriptApp.newTrigger('updateDailySummary').timeBased().everyDays(1).atHour(2).create(); }
function updateDailySummary() {
  const ss = getSpreadsheet();
  const source = ss.getSheetByName('Inspections');
  const summary = ss.getSheetByName('Daily Summary');
  if (!source || !summary || source.getLastRow() < 2) return;
  const rows = source.getRange(2, 1, source.getLastRow() - 1, 15).getValues();
  const grouped = {};
  rows.forEach(function (row) {
    const key = [row[1], row[2], row[3], row[4]].join('|');
    grouped[key] = [row[1], row[2], row[3], row[4], true, row[5], row[7], row[12], row[10], ''];
  });
  const output = Object.keys(grouped).map(function (key) { return grouped[key]; });
  if (summary.getLastRow() > 1) summary.getRange(2, 1, summary.getLastRow() - 1, 10).clearContent();
  if (output.length) summary.getRange(2, 1, output.length, 10).setValues(output);
}
