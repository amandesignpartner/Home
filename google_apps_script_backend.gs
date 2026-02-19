/**
 * Tracker Sync Backend - PRODUCTION V2
 * Live Ready Architecture
 */

// FORCE PERMISSIONS: Run this function in the toolbar if you get "Drive" errors
function forceScope() { DriveApp.getFoldersByName('Authorize'); }

const CONFIG = {
  SHEET_NAME: 'TrackerData',
  FEEDBACK_SHEET_NAME: 'Feedback',
  SUBMISSIONS_SHEET_NAME: 'Submissions',
  ATTACHMENTS_FOLDER_ID: '10QQIt6fSRgTzxIZU7KdzDoLGlfAausCT',
  ID_PREFIX: 'VMC',
  STARTING_ID_NUM: 125
};

/* ============================= */
/* ========= GET API =========== */
/* ============================= */

function doGet(e) {
  const sheet = getSheet();
  const params = e.parameter;

  if (params.action === 'getNextID') {
    return json({ status: "success", nextID: generateNextID(sheet) });
  }

  if (params.action === 'getProject' && params.id) {
    const project = findProjectByID(sheet, params.id);
    return json(project
      ? { status: "success", project }
      : { status: "error", message: "Project not found" });
  }

  if (params.action === 'getAll') {
    return json({ status: "success", data: getAllProjects(sheet) });
  }

  if (params.action === 'getFeedback') {
    const fbSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.FEEDBACK_SHEET_NAME);
    if (!fbSheet) return json({ status: "success", data: [] });
    const data = fbSheet.getDataRange().getValues();
    const results = [];
    for (let i = 1; i < data.length; i++) {
      results.push({
        timestamp: data[i][0],
        projectID: data[i][1],
        projectName: data[i][2],
        clientName: data[i][3],
        rating: data[i][4],
        message: data[i][5]
      });
    }
    return json({ status: "success", data: results.reverse() }); // Newest first
  }

  return json({ status: "error", message: "Invalid request" });
}

/* ============================= */
/* ========= POST API ========== */
/* ============================= */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // prevent race condition

  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'submitFeedback') {
      return json(handleFeedback(data.feedback));
    }

    // Handle Project Brief Submission
    if (data.action === 'submitBrief') {
      return json(handleBrief(data.brief));
    }

    const sheet = getSheet();
    const project = data.project || data;

    if (!project.id) throw new Error("Missing project ID");

    const result = updateOrInsert(sheet, project);

    return json({
      status: "success",
      message: result.message,
      version: result.version
    });

  } catch (err) {
    return json({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function handleFeedback(fb) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.FEEDBACK_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.FEEDBACK_SHEET_NAME);
    sheet.appendRow(["Timestamp", "Project ID", "Project Name", "Client Name", "Rating", "Message"]);
    sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f3f3");
  }

  const now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss"),
    fb.projectID || '',
    fb.projectName || '',
    fb.clientName || '',
    fb.rating || '',
    fb.message || ''
  ]);

  return { status: "success", message: "Feedback saved" };
}

function handleBrief(brief) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SUBMISSIONS_SHEET_NAME);
  
  // MATCHING HEADINGS STYLE: All Fields included exactly in order
  const headers = [
    "Timestamp", "Name", "Email", "Phone", "Project Title", 
    "Services", "Other Service", "Work Type", 
    "Interior Items", "Interior Other", "Exterior Items", "Exterior Other",
    "Billing Type", "Budget", "Timeline", "Message", 
    "Attachment Link", "External File Link"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SUBMISSIONS_SHEET_NAME);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }

  // Handle Attachment if exists
  let attachmentUrl = "";
  if (brief.attachment && brief.attachment.data) {
    attachmentUrl = saveFileToDrive(brief.attachment);
  }

  const now = new Date();
  const row = [
    Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss"),
    brief.name || "",
    brief.email || "",
    brief.phone || "",
    brief.projectTitle || "",
    (brief.services || []).join(", "),
    brief.otherService || "",
    brief.workType || "",
    (brief.interiorItems || []).join(", "),
    brief.interiorCustom || "",
    (brief.exteriorItems || []).join(", "),
    brief.exteriorCustom || "",
    brief.billingType || "",
    brief.budget || brief.budgetCustom || "",
    brief.timeline || brief.timelineCustom || "",
    brief.message || "",
    attachmentUrl,
    brief.fileLink || ""
  ];

  sheet.appendRow(row);
  return { status: "success", message: "Brief submitted successfully", attachmentUrl: attachmentUrl };
}

function saveFileToDrive(fileObj) {
  try {
    const folder = DriveApp.getFolderById(CONFIG.ATTACHMENTS_FOLDER_ID);
    const contentType = fileObj.data.substring(fileObj.data.indexOf(":") + 1, fileObj.data.indexOf(";"));
    const bytes = Utilities.base64Decode(fileObj.data.split(",")[1]);
    const blob = Utilities.newBlob(bytes, contentType, fileObj.name);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (e) {
    return "Error saving file: " + e.toString();
  }
}

/* ============================= */
/* ===== CORE FUNCTIONS ======== */
/* ============================= */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
}

function updateOrInsert(sheet, project) {
  const data = sheet.getDataRange().getValues();
  const cleanID = clean(project.id);
  let rowIdx = -1;
  let version = 1;

  for (let i = 1; i < data.length; i++) {
    if (clean(data[i][0]) === cleanID) {
      rowIdx = i + 1;
      version = (data[i][13] || 0) + 1; // version column
      break;
    }
  }

  const now = new Date();

  const row = [
    project.id,
    project.client || '',
    project.project || '',
    project.cost || '',
    project.status || 'progress',
    project.startDate || '',
    project.phase || '',
    Utilities.formatDate(now, "GMT+5", "d MMM yyyy"), // lastUpdated formatted
    project.deadline || '',
    project.nextMilestone || '',
    project.pendingAmount || '',
    project.downloadLink || '#',
    project.whatsappLink || '',
    version // version column
  ];

  if (rowIdx !== -1) {
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    return { message: "Updated", version };
  } else {
    sheet.appendRow(row);
    return { message: "Inserted", version };
  }
}

function findProjectByID(sheet, id) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const cleanID = clean(id);

  for (let i = 1; i < data.length; i++) {
    if (clean(data[i][0]) === cleanID) {
      return mapRow(data[i]);
    }
  }
  return null;
}

function getAllProjects(sheet) {
  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    result.push(mapRow(data[i]));
  }

  return result;
}

function mapRow(row) {
  return {
    id: row[0],
    client: row[1],
    project: row[2],
    cost: row[3],
    status: row[4],
    startDate: row[5],
    phase: row[6],
    lastUpdated: formatDate(row[7]),
    deadline: row[8],
    nextMilestone: row[9],
    pendingAmount: row[10],
    downloadLink: row[11],
    whatsappLink: row[12],
    version: row[13] || 1
  };
}

function generateNextID(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNum = CONFIG.STARTING_ID_NUM;

  // Extract the highest number from existing IDs
  for (let i = 1; i < data.length; i++) {
    const idStr = data[i][0].toString().toUpperCase();
    
    // Safety check for VMC-26H125-W format
    // We want the digits specifically after the "H" or in the middle section
    const parts = idStr.split(/[-H]/);
    for (let p of parts) {
      if (/^\d{3,}$/.test(p)) {
        const num = parseInt(p);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextSeq = maxNum + 1;
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // e.g. "26"
  const type = "H"; // Based on VMC-26H125-W
  const suffix = "W"; // Based on VMC-26H125-W
  
  // Return the robustly formatted ID
  return `${CONFIG.ID_PREFIX}-${year}${type}${nextSeq}-${suffix}`;
}

function clean(id) {
  return id.toString().replace(/-/g, '').toUpperCase();
}

function formatDate(date) {
  if (!date) return "";
  if (date instanceof Date) {
    return Utilities.formatDate(date, "GMT+5", "d MMM yyyy");
  }
  return date.toString();
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
