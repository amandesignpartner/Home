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
  ADMIN_SHEET_NAME: 'AdminConfig',
  PAYMENTS_SHEET_NAME: 'Payments',
  ATTACHMENTS_FOLDER_ID: '10QQIt6fSRgTzxIZU7KdzDoLGlfAausCT',
  NOTIFICATION_EMAIL: 'aman.designpartner@gmail.com',
  ID_PREFIX: 'VMC',
  STARTING_ID_NUM: 125
};

/* ============================= */
/* ========= GET API =========== */
/* ============================= */

function doGet(e) {
  const params = e.parameter;
  if (params.action === 'getNextID') return json({ status: "success", nextID: generateNextID(getSheet()) });
  
  if (params.action === 'getProject' && params.id) {
    const project = findProjectByID(getSheet(), params.id);
    return json(project ? { status: "success", project } : { status: "error", message: "Project not found" });
  }

  if (params.action === 'getAll') return json({ status: "success", data: getAllProjects(getSheet()) });

  if (params.action === 'getPublicBriefs') {
    const briefs = getAllBriefs().map(b => ({
      rowId: b.rowId,
      projectTitle: b.projectTitle,
      status: b.status,
      year: extractYear(b.timestamp)
    }));
    return json({ status: "success", data: briefs });
  }

  if (params.action === 'getBriefs') {
    if (!checkAdminAuth(params.user, params.pass)) return json({ status: "error", message: "Unauthorized" });
    return json({ status: "success", data: getAllBriefs() });
  }

  if (params.action === 'getFeedback') {
    const fbSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.FEEDBACK_SHEET_NAME);
    if (!fbSheet) return json({ status: "success", data: [] });
    const data = fbSheet.getDataRange().getValues();
    const results = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        results.push({
          timestamp: data[i][0],
          projectID: data[i][1],
          projectName: data[i][2],
          clientName: data[i][3],
          rating: data[i][4],
          message: data[i][5]
        });
      }
    }
    return json({ status: "success", data: results.reverse() });
  }

  return json({ status: "error", message: "Invalid request" });
}

/* ============================= */
/* ========= POST API ========== */
/* ============================= */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); 

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // Explicit cases with direct returns to prevent falling through to tracker logic
    if (action === 'submitFeedback') return json(handleFeedback(data.feedback));
    if (action === 'submitBrief') return json(handleBrief(data.brief));
    if (action === 'submitPayment') return json(handlePayment(data));
    if (action === 'logDownload') return json(handleDownloadLog(data));
    
    if (action === 'adminLogin') {
      const isValid = checkAdminAuth(data.user, data.pass);
      return json(isValid ? { status: "success" } : { status: "error", message: "Invalid credentials" });
    }
    
    if (action === 'markBriefRead') {
      if (!checkAdminAuth(data.user, data.pass)) return json({ status: "error", message: "Unauthorized" });
      return json(markBriefAsRead(data.rowId));
    }

    // Default: Tracker Data Synchronization
    const sheet = getSheet();
    const project = data.project || data;
    if (!project.id) {
       // If no action matched and no project ID, it's an invalid request
       return json({ status: "error", message: "Invalid action or missing project ID" });
    }

    const result = updateOrInsert(sheet, project);
    return json({ status: "success", message: result.message, version: result.version });

  } catch (err) {
    return json({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function extractYear(timestamp) {
  if (!timestamp) return new Date().getFullYear().toString();
  const dateStr = timestamp.toString();
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : new Date().getFullYear().toString();
}

function handleFeedback(fb) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.FEEDBACK_SHEET_NAME);
  const headers = ["Timestamp", "Project ID", "Project Name", "Client Name", "Rating", "Message"];
  
  if (!sheet) sheet = ss.insertSheet(CONFIG.FEEDBACK_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }

  const now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss"),
    fb.projectID || '', fb.projectName || '', fb.clientName || '', fb.rating || '', fb.message || ''
  ]);

  try {
    const emailBody = `⭐ NEW FEEDBACK RECEIVED\n\nClient: ${fb.clientName}\nProject: ${fb.projectName} (${fb.projectID})\nRating: ${fb.rating}/5\nMessage: ${fb.message}`;
    GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, "New Client Feedback: " + fb.clientName, emailBody);
  } catch(e) {}

  return { status: "success", message: "Feedback saved" };
}

function handleBrief(brief) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SUBMISSIONS_SHEET_NAME);
  const headers = [
    "Timestamp", "Name", "Email", "Phone", "Project Title", 
    "Services", "Other Service", "Work Type", 
    "Interior Items", "Interior Other", "Exterior Items", "Exterior Other",
    "Billing Type", "Budget", "Timeline", "Message", 
    "Attachment Link", "External File Link"
  ];

  if (!sheet) sheet = ss.insertSheet(CONFIG.SUBMISSIONS_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }

  let attachmentUrl = "";
  if (brief.attachment && brief.attachment.data) attachmentUrl = saveFileToDrive(brief.attachment);

  const now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss"),
    brief.name || "", brief.email || "", brief.phone || "", brief.projectTitle || "",
    (brief.services || []).join(", "), brief.otherService || "", brief.workType || "",
    (brief.interiorItems || []).join(", "), brief.interiorCustom || "",
    (brief.exteriorItems || []).join(", "), brief.exteriorCustom || "",
    brief.billingType || "", brief.budget || brief.budgetCustom || "",
    brief.timeline || brief.timelineCustom || "", brief.message || "",
    attachmentUrl, brief.fileLink || "",
    "Unread" // Default Status
  ]);

  try {
    const emailBody = `🚀 NEW PROJECT BRIEF\n\nClient: ${brief.name}\nProject: ${brief.projectTitle}\nPhone: ${brief.phone}\nLink: ${attachmentUrl || 'No attachment'}\n\nFull details in Google Sheets.`;
    GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, "New Project Brief: " + brief.name, emailBody);
  } catch(e) {}

  return { status: "success", message: "Brief received", attachmentUrl };
}

function getAllBriefs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SUBMISSIONS_SHEET_NAME);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const results = [];
  
  // Headers are: Timestamp, Name, Email, Phone, Project Title, Services, Other Service, Work Type, Interior Items, Interior Other, Exterior Items, Exterior Other, Billing Type, Budget, Timeline, Message, Attachment Link, External File Link, Read_Status
  for (let i = 1; i < data.length; i++) {
    if (data[i][4]) { // If Project Title exists
      results.push({
        rowId: i + 1,
        timestamp: data[i][0],
        clientName: data[i][1],
        email: data[i][2],
        phone: data[i][3],
        projectTitle: data[i][4],
        services: data[i][5],
        otherService: data[i][6],
        workType: data[i][7],
        interiorItems: data[i][8],
        interiorOther: data[i][9],
        exteriorItems: data[i][10],
        exteriorOther: data[i][11],
        billingType: data[i][12],
        budget: data[i][13],
        timeline: data[i][14],
        message: data[i][15],
        attachment: data[i][16],
        fileLink: data[i][17],
        status: data[i][18] || "Unread"
      });
    }
  }
  return results.reverse();
}

function checkAdminAuth(user, pass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.ADMIN_SHEET_NAME);
  
  // Auto-create if doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ADMIN_SHEET_NAME);
    sheet.appendRow(["Username", "Password"]);
    sheet.appendRow(["aman_admin", "Tijarah@2024"]);
    sheet.hideSheet();
  }
  
  const data = sheet.getDataRange().getValues();
  // Check against row 2 (first account)
  return (user === data[1][0] && pass === data[1][1]);
}

function markBriefAsRead(rowId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SUBMISSIONS_SHEET_NAME);
  if (!sheet) return { status: "error" };
  
  // Column 19 is Read_Status (S)
  sheet.getRange(rowId, 19).setValue("Read");
  return { status: "success" };
}

function handlePayment(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.PAYMENTS_SHEET_NAME);
  const headers = ["Timestamp", "Client Name", "Project ID", "Project Name", "Amount", "Currency", "MTCN / Reference", "Status", "Proof Link"];
  
  if (!sheet) sheet = ss.insertSheet(CONFIG.PAYMENTS_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }

  let proofUrl = "";
  if (data.proofFile && data.proofFile.data) {
    try {
      proofUrl = saveFileToDrive(data.proofFile);
    } catch(e) {
      proofUrl = "Error saving file: " + e.toString();
    }
  }

  const now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss"),
    data.name || "", data.project_id || "", data.project_name || "", data.amount || "",
    data.currency || "USD", data.mtcn || "", "Pending Verification", proofUrl
  ]);

  try {
    const emailBody = `💰 NEW PAYMENT SUBMITTED\n\nClient: ${data.name}\nProject: ${data.project_name} (${data.project_id})\nAmount: ${data.amount} ${data.currency || 'USD'}\nReference: ${data.mtcn}\n\nProof Link: ${proofUrl || 'No attachment provided.'}`;
    GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, "New Payment Alert: " + data.name, emailBody);
  } catch(e) {}

  return { status: "success", message: "Payment details logged", proofUrl };
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

function handleDownloadLog(data) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const cleanID = clean(data.id);
  const now = new Date();
  const timestamp = Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss");
  
  for (let i = 1; i < rows.length; i++) {
    if (clean(rows[i][0]) === cleanID) {
      // Column 15 is "Client View Status"
      sheet.getRange(i + 1, 15).setValue("Viewed on " + timestamp);
      
      try {
        const emailBody = `👀 CLIENT ALERT\n\nClient: ${rows[i][1]}\nProject: ${rows[i][2]} (${rows[i][0]})\nStatus: Opened/Downloaded project files.\nTime: ${timestamp}`;
        GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, "File Viewed: " + rows[i][1], emailBody);
      } catch(e) {}
      
      return { status: "success", message: "Download logged" };
    }
  }
  return { status: "error", message: "Project not found" };
}

/* ============================= */
/* ===== CORE FUNCTIONS ======== */
/* ============================= */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
  
  // Auto-Repair Headers for Tracker Data
  const headers = ["ID", "Client", "Project", "Cost", "Amount to Pay", "Status", "Start Date", "Phase", "Last Updated", "Deadline", "Next Milestone", "Pending", "Download", "WhatsApp", "Version", "Client View Status"];
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== "ID") {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function updateOrInsert(sheet, project) {
  // headers used for mapping
  const headers = ["ID", "Client", "Project", "Cost", "Amount to Pay", "Status", "Start Date", "Phase", "Last Updated", "Deadline", "Next Milestone", "Pending", "Download", "WhatsApp", "Version", "Client View Status"];
  
  const data = sheet.getDataRange().getValues();
  const cleanID = clean(project.id);
  let rowIdx = -1;
  let version = 1;

  for (let i = 1; i < data.length; i++) {
    if (clean(data[i][0]) === cleanID) {
      rowIdx = i + 1;
      version = (data[i][13] || 0) + 1;
      break;
    }
  }

  const now = new Date();
  const row = [
    project.id, project.client || '', project.project || '', project.cost || '',
    project.amountToPay || '', project.status || 'progress', project.startDate || '', 
    project.phase || '', Utilities.formatDate(now, "GMT+5", "d MMM yyyy"), 
    project.deadline || '', project.nextMilestone || '', project.pendingAmount || '',
    project.downloadLink || '#', project.whatsappLink || '', version
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
    amountToPay: row[4],
    status: row[5],
    startDate: row[6],
    phase: row[7],
    lastUpdated: formatDate(row[8]),
    deadline: row[9],
    nextMilestone: row[10],
    pendingAmount: row[11],
    downloadLink: row[12],
    whatsappLink: row[13],
    version: row[14] || 1
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
