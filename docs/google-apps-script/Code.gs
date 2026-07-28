const SPREADSHEET_ID = '1SyqwCcKwtTbKlJD6HC60h7Be5GcChiGE_T02fzli-JQ';

const SHEETS = {
  'Completed Checklists': ['Date','Location','Checklist','Daypart','Manager','Completed','Completion Time','Notes']
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
    const actions = body.actions || {};
    const notes = Object.keys(actions).map(function (questionId) { const action = actions[questionId] || {}; return action.action ? (action.issue ? action.issue + ': ' : '') + action.action : ''; }).filter(String).join('\n');
    append('Completed Checklists', [body.businessDate, body.floorNumber, body.area, body.daypart, body.manager, 'Yes', now, notes || body.notes || '']);
    return json({ success: true, inspectionId: id });
  } catch (error) { return json({ success: false, error: error.message || 'Unable to save inspection.' }); }
  finally { try { lock.releaseLock(); } catch (ignored) {} }
}

function validate(body) { ['businessDate','floorNumber','manager','area','daypart','startedAt','responses'].forEach(function (key) { if (body[key] === undefined || body[key] === null || body[key] === '') throw new Error('Missing required field: ' + key); }); if (!['Bar','Beverage Stations'].includes(body.area)) throw new Error('Invalid area.'); }
function getSpreadsheet() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function append(tab, row) { getSpreadsheet().getSheetByName(tab).appendRow(row); }
function appendMany(tab, rows) { const sheet = getSpreadsheet().getSheetByName(tab); sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows); }
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function setupSpreadsheet() { const ss = getSpreadsheet(); Object.keys(SHEETS).forEach(function (name) { let sheet = ss.getSheetByName(name) || ss.insertSheet(name); sheet.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]); sheet.setFrozenRows(1); sheet.getRange(1,1,1,SHEETS[name].length).setFontWeight('bold').setBackground('#07192d').setFontColor('#ffffff'); sheet.autoResizeColumns(1,SHEETS[name].length); }); }
function updateDailySummary() {}
