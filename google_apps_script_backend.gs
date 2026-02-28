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

  if (params.action === 'getYears') {
    return json({ status: "success", years: getAvailableYears() });
  }

  if (params.action === 'getPublicBriefs') {
    const year = params.year || new Date().getFullYear().toString();
    const briefs = getAllBriefs()
      .filter(b => b.year && b.year.toString() === year.toString())
      .map(b => ({
        rowId: b.rowId,
        projectTitle: b.projectTitle,
        status: b.status,
        year: year
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

  // Two-way sync: get a specific Zoom meeting booking by Booking ID
  if (params.action === 'getZoomMeeting' && params.bookingId) {
    return json(getZoomMeetingById(params.bookingId));
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
    let data;
    try {
      if (!e.postData || !e.postData.contents) {
        return json({ status: "error", message: "No post data received" });
      }
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return json({ status: "error", message: "Invalid JSON format: " + parseErr.toString() });
    }

    const action = data.action;
    
    // Explicit cases with direct returns
    if (action === 'submitFeedback') return json(handleFeedback(data.feedback));
    if (action === 'submitBrief') return json(handleBrief(data.brief));
    if (action === 'submitPayment') return json(handlePayment(data));
    if (action === 'logDownload') return json(handleDownloadLog(data));
    if (action === 'submitZoomMeeting') return json(handleZoomMeeting(data));
    if (action === 'logVisitor') return json(handleVisitorLog(data));
    
    if (action === 'adminLogin') {
      const isValid = checkAdminAuth(data.user, data.pass);
      return json(isValid ? { status: "success" } : { status: "error", message: "Invalid credentials" });
    }
    
    if (action === 'markBriefRead') {
      if (!checkAdminAuth(data.user, data.pass)) return json({ status: "error", message: "Unauthorized" });
      return json(markBriefAsRead(data.rowId));
    }

    // Default: Tracker Data Synchronization (Requires project.id)
    const sheet = getSheet();
    const project = data.project || data;
    if (project && (project.id || project.rowId)) {
       const result = updateOrInsert(sheet, project);
       return json({ status: "success", message: result.message, version: result.version });
    }

    return json({ status: "error", message: "Action '" + action + "' not recognized or missing ID" });

  } catch (err) {
    return json({ status: "error", message: "System Error: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getAvailableYears() {
  const years = [];
  // Strictly enforce 2016-2026 range only
  for (let y = 2026; y >= 2016; y--) {
    years.push(y.toString());
  }
  return years;
}function extractYear(timestamp) {
  if (!timestamp) return new Date().getFullYear().toString();
  const dateStr = timestamp.toString();
  const match = dateStr.match(/\d{4}/);
  const year = match ? match[0] : new Date().getFullYear().toString();
  // Valid range check
  const yNum = parseInt(year);
  if (yNum < 2016) return "2016";
  if (yNum > 2026) return "2026";
  return year;
}

function handleFeedback(fb) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.FEEDBACK_SHEET_NAME);
  const headers = ["Timestamp", "Project ID", "Project Title", "Client Name", "Rating", "Message"];
  
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
  const sheetName = CONFIG.SUBMISSIONS_SHEET_NAME;
  let sheet = ss.getSheetByName(sheetName);
  
  // Robust check: find sheet case-insensitively
  if (!sheet) {
    const sheets = ss.getSheets();
    for (let s of sheets) {
      if (s.getName().toLowerCase() === sheetName.toLowerCase()) {
        sheet = s;
        break;
      }
    }
  }

  const headers = [
    "Year", "Timestamp", "Name", "Email", "Phone", "Project Title", 
    "Services", "Other Service", "Work Type", 
    "Interior Items", "Interior Other", "Exterior Items", "Exterior Other",
    "Billing Type", "Budget", "Timeline", "Message", 
    "Attachment Link", "External File Link", "Status"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#8B5A2B").setColor("white");
    sheet.setFrozenRows(1);
  } else {
    // Check if Status column (20) exists now due to shift
    if (sheet.getLastColumn() < 20) {
      sheet.getRange(1, 20).setValue("Status").setFontWeight("bold").setBackground("#8B5A2B").setColor("white");
    }
  }

  let attachmentUrl = "";
  if (brief.attachment && brief.attachment.data) attachmentUrl = saveFileToDrive(brief.attachment);

  const now = new Date();
  const rowData = [
    now.getFullYear().toString(), // Column A: Year
    Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss"), // Column B: Timestamp
    brief.name || "", brief.email || "", brief.phone || "", brief.projectTitle || "",
    (brief.services || []).join(", "), brief.otherService || "", brief.workType || "",
    (brief.interiorItems || []).join(", "), brief.interiorCustom || "",
    (brief.exteriorItems || []).join(", "), brief.exteriorCustom || "",
    brief.billingType || "", brief.budget || brief.budgetCustom || "",
    brief.timeline || brief.timelineCustom || "", brief.message || "",
    attachmentUrl, brief.fileLink || "",
    "Not Viewed"
  ];
  
  sheet.appendRow(rowData);

  try {
    const emailBody = `🚀 NEW PROJECT BRIEF\n\nClient: ${brief.name}\nProject: ${brief.projectTitle}\nPhone: ${brief.phone}\nLink: ${attachmentUrl || 'No attachment'}\n\nFull details in Google Sheets.`;
    GmailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, "New Project Brief: " + brief.name, emailBody);
  } catch(e) {}

  return { status: "success", message: "Brief received", attachmentUrl };
}

function getAllBriefs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SUBMISSIONS_SHEET_NAME);
  if (!sheet) {
     const sheets = ss.getSheets();
     for (let s of sheets) {
       if (s.getName().toLowerCase() === CONFIG.SUBMISSIONS_SHEET_NAME.toLowerCase()) {
         sheet = s;
         break;
       }
     }
  }
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    // If Year is in A (0) and Project Title is in F (5)
    if (data[i][5] || data[i][4]) { 
      const yearVal = data[i][0] ? data[i][0].toString() : "";
      const ts = data[i][1];
      
      results.push({
        rowId: i + 1,
        timestamp: ts,
        year: yearVal || extractYear(ts),
        clientName: data[i][2],
        email: data[i][3],
        phone: data[i][4],
        projectTitle: data[i][5],
        services: data[i][6],
        otherService: data[i][7],
        workType: data[i][8],
        interiorItems: data[i][9],
        interiorOther: data[i][10],
        exteriorItems: data[i][11],
        exteriorOther: data[i][12],
        billingType: data[i][13],
        budget: data[i][14],
        timeline: data[i][15],
        message: data[i][16],
        attachment: data[i][17],
        fileLink: data[i][18],
        status: data[i][19] || "Not Viewed"
      });
    }
  }
  return results.reverse();
}

/**
 * Checks admin credentials against the AdminConfig sheet.
 * This allows you to easily change your password in the Google Sheet.
 */
function checkAdminAuth(user, pass) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.ADMIN_SHEET_NAME);
  
  // Auto-create if doesn't exist (Hidden by default)
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.ADMIN_SHEET_NAME);
    sheet.appendRow(["Username", "Password"]);
    sheet.appendRow(["aman_admin", "Tijarah@2024"]);
    sheet.hideSheet();
    
    // Set protection so only you can edit
    try {
      const protection = sheet.protect().setDescription('Admin Credentials Protection');
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    } catch(e) {}
  }
  
  const data = sheet.getDataRange().getValues();
  // Check against row 2 (index 1)
  return (user === data[1][0] && pass === data[1][1]);
}

function markBriefAsRead(rowId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SUBMISSIONS_SHEET_NAME);
  if (!sheet) return { status: "error" };
  
  // Column 20 is Status (T) due to Year column shift
  sheet.getRange(rowId, 20).setValue("Viewed");
  return { status: "success" };
}

function handlePayment(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.PAYMENTS_SHEET_NAME);
  const headers = ["Timestamp", "Client Name", "Project ID", "Project Title", "Amount", "Currency", "MTCN / Reference", "Status", "Proof Link"];
  
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
      // Column 16 is "Client View Status"
      sheet.getRange(i + 1, 16).setValue("Viewed on " + timestamp);
      
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
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  // If TrackerData is missing, create it to avoid guessing/overwriting other sheets
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  
  const headers = ["Project ID", "Client Name", "Project Title", "Total Cost", "Amount to Pay (Deposit)", "Project Status", "Project Started Date", "Current Phase", "Last Updated", "Project Delivery Date", "Total Project Milestones", "Pending Payment", "Download Link", "WhatsApp Link", "Version", "Client View Status"];
  
  // Get existing A1 value to check if headers are already set
  const firstCell = sheet.getRange(1, 1).getValue().toString().trim();
  
  // Only inject/repair if the sheet is completely empty OR A1 is clearly wrong (not matching new or old header)
  if (sheet.getLastRow() === 0 || (firstCell !== "Project ID" && firstCell !== "ID")) {
    // Final guard: If A1 already says "Project ID", do NOT insert again
    if (firstCell !== "Project ID") {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }
  }
  
  return sheet;
}

function updateOrInsert(sheet, project) {
  // headers used for mapping
  const headers = ["Project ID", "Client Name", "Project Title", "Total Cost", "Amount to Pay (Deposit)", "Project Status", "Project Started Date", "Current Phase", "Last Updated", "Project Delivery Date", "Total Project Milestones", "Pending Payment", "Download Link", "WhatsApp Link", "Version", "Client View Status"];
  
  const data = sheet.getDataRange().getValues();
  const cleanID = clean(project.id);
  let rowIdx = -1;
  let version = 1;

  for (let i = 1; i < data.length; i++) {
    if (clean(data[i][0]) === cleanID) {
      rowIdx = i + 1;
      version = (data[i][14] || 0) + 1;
      
      // AUTO-START DATE: If status changes to progress, set today's date
      if (project.status === 'progress' && data[i][5] !== 'progress') {
        project.startDate = Utilities.formatDate(new Date(), "GMT+5", "d MMM yyyy");
      }
      break;
    }
  }

  // If new project and status is progress, set start date
  if (rowIdx === -1 && project.status === 'progress') {
    project.startDate = Utilities.formatDate(new Date(), "GMT+5", "d MMM yyyy");
  }

  const now = new Date();
  const row = [
    project.id, project.client || '', project.project || '', project.cost || '',
    project.amountToPay || '', project.status || 'progress', project.startDate || '', 
    project.phase || '', Utilities.formatDate(now, "GMT+5", "d MMM yyyy"), 
    project.deadline || '', project.nextMilestone || '', project.pendingAmount || '',
    project.downloadLink || '#', project.whatsappLink || '', version,
    project.clientViewStatus || ''
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
    startDate: formatDate(row[6]),
    phase: row[7],
    lastUpdated: formatDate(row[8]),
    deadline: formatDate(row[9]),
    nextMilestone: row[10],
    pendingAmount: row[11],
    downloadLink: row[12],
    whatsappLink: row[13],
    version: row[14] || 1,
    clientViewStatus: row[15] || ''
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

/**
 * RUN THIS ONCE from the GAS Editor toolbar to populate your sheet with 900+ historical records.
 */
function seedHistoricalData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SUBMISSIONS_SHEET_NAME);
  if (!sheet) return "Error: Submissions sheet not found.";
  
  const PREFIXES = ["Modern", "Luxury", "Minimalist", "Classic", "Premium", "Industrial", "Sustainable", "Zen", "Contemporary", "Smart", "Compact", "Grand", "Urban", "Rustic", "Vintage", "Futuristic", "Nordic", "Elite", "High-End", "Eco", "Boutique", "Majestic", "Sleek", "Cozy", "Grandiose"];
  const TYPES = ["2D Floor Plan Layout", "3D Interior Design Visualization", "Exterior Architectural Rendering", "3D Walkthrough Animation", "VR 360 Virtual Reality Tour", "Full Permit & Planning Layout", "Schematic Concept Design", "Detailed 3D Modeling", "Landscape & Garden Design", "Structural Layout", "BIM Environment Model", "Photorealistic Rendering"];
  const AREAS = ["Home Gym Section", "Executive Private Office", "Master Suite Wing", "Luxury Penthouse", "Duplex Family Villa", "Backyard Studio", "Suburban Farmhouse", "Commercial Retail Shop", "Urban Coffee Bar", "Open-Plan Living Space", "Designer Kitchen", "Rooftop Terrace", "Base Suite", "Industrial Loft", "Media Room", "Spa Area", "Community Hub", "High-Tech Lab", "Art Lounge", "Smart Garage"];

  const allRows = [];
  
  // 2016-2025: 92 projects each
  for (let year = 2016; year <= 2025; year++) {
    for (let i = 0; i < 92; i++) {
      const pIdx = (i + year * 7) % PREFIXES.length;
      const tIdx = (i + year * 3) % TYPES.length;
      const aIdx = (i + year * 11) % AREAS.length;
      const title = `${PREFIXES[pIdx]} ${AREAS[aIdx]} - ${TYPES[tIdx]}`;
      
      allRows.push([
        year.toString(), new Date(year, 0, 1).toISOString(), "Historical Record",
        "archive@aman.design", "N/A", title, "Visualization", "", "Residential",
        "", "", "", "", "Fixed", "N/A", "Completed", "Portfolio asset.", "", "", "Viewed"
      ]);
    }
  }

  // 2026: 4 projects
  for (let i = 0; i < 4; i++) {
     allRows.push([
        "2026", new Date().toISOString(), "Active Client", "client@example.com", 
        "N/A", `Current Project ${i+1} - Premium Design`, "Consultation", "", 
        "Commercial", "", "", "", "", "Hourly", "N/A", "Active", "Live inquiry.", "", "", "Viewed"
      ]);
  }

  if (allRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, allRows.length, allRows[0].length).setValues(allRows);
  }
  return "Successfully added " + allRows.length + " historical records!";
}

/* ============================= */
/* ===== ZOOM MEETING SYNC ===== */
/* ============================= */

/**
 * ZOOM_MEETINGS sheet column map (1-indexed):
 *  1  - Booking ID
 *  2  - Client Name
 *  3  - Client Email
 *  4  - Client Time Zone
 *  5  - Meeting Date
 *  6  - Selected Time Slot
 *  7  - Client Local Time
 *  8  - Pakistan Time
 *  9  - Zoom Meeting Link
 *  10 - Booking Status
 *  11 - Created At
 *  12 - Last Updated
 */
function getZoomSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ZOOM_SHEET_NAME = 'Zoom Meetings';
  let sheet = ss.getSheetByName(ZOOM_SHEET_NAME);

  const headers = [
    "Booking ID", "Client Name", "Client Email", "Client Time Zone",
    "Meeting Date", "Selected Time Slot", "Client Local Time", "Pakistan Time",
    "Zoom Meeting Link", "Booking Status", "Created At", "Last Updated"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(ZOOM_SHEET_NAME);
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold").setBackground("#1a6fd8").setFontColor("white");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(9, 260);
    sheet.setColumnWidth(11, 150);
    sheet.setColumnWidth(12, 150);
  } else {
    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1a6fd8").setFontColor("white");
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

function handleZoomMeeting(data) {
  try {
    const sheet = getZoomSheet();
    const now = new Date();
    const nowFormatted = Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss");

    // --- Upsert: check if Booking ID already exists ---
    const rows = sheet.getDataRange().getValues();
    let existingRowIdx = -1;
    const bookingId = (data.bookingId || '').toString().trim().toUpperCase();

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0].toString().trim().toUpperCase() === bookingId) {
        existingRowIdx = i + 1; // 1-indexed sheet row
        break;
      }
    }

    const rowData = [
      data.bookingId     || '',
      data.clientName    || '',
      data.clientEmail   || '',
      data.clientTimeZone|| '',
      data.meetingDate   || '',
      data.selectedSlot  || '',
      data.clientLocalTime || '',
      data.pakistanTime  || '',
      data.zoomLink      || '',
      data.bookingStatus || 'Confirmed',
      existingRowIdx === -1 ? nowFormatted : rows[existingRowIdx - 1][10], // Keep original createdAt
      nowFormatted  // Last Updated always refreshed
    ];

    if (existingRowIdx !== -1) {
      // Update existing row (keep Created At in col 11, update Last Updated in col 12)
      sheet.getRange(existingRowIdx, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    // --- Email Notification ---
    try {
      const zoomLinkHtml = data.zoomLink ? `<a href="${data.zoomLink}" style="color:#2D8CFF;">${data.zoomLink}</a>` : 'Not provided';
      const emailBody = `📅 NEW ZOOM MEETING BOOKED\n\n` +
        `Client: ${data.clientName || 'N/A'}\n` +
        `Meeting Date: ${data.meetingDate || 'N/A'}\n` +
        `Selected Slot: ${data.selectedSlot || 'N/A'}\n` +
        `Pakistan Time: ${data.pakistanTime || 'N/A'}\n` +
        `Client Local Time: ${data.clientLocalTime || 'N/A'}\n` +
        `Client Time Zone: ${data.clientTimeZone || 'N/A'}\n` +
        `Zoom Link: ${data.zoomLink || 'N/A'}\n` +
        `Booking ID: ${data.bookingId || 'N/A'}`;

      const htmlBody = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2D8CFF,#1A6FD8);padding:20px 24px;">
            <h2 style="margin:0;font-size:20px;color:#fff;">📅 New Zoom Meeting Booked</h2>
          </div>
          <div style="padding:24px;line-height:1.8;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#94a3b8;width:40%">Client Name</td><td style="padding:6px 0;font-weight:600;">${data.clientName || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8;">Meeting Date</td><td style="padding:6px 0;font-weight:600;">${data.meetingDate || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8;">Selected Slot</td><td style="padding:6px 0;font-weight:600;">${data.selectedSlot || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8;">🇵🇰 Pakistan Time</td><td style="padding:6px 0;font-weight:600;">${data.pakistanTime || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8;">🌍 Client Local Time</td><td style="padding:6px 0;font-weight:600;">${data.clientLocalTime || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8;">Client Time Zone</td><td style="padding:6px 0;">${data.clientTimeZone || 'N/A'}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8;">Zoom Link</td><td style="padding:6px 0;">${zoomLinkHtml}</td></tr>
              <tr><td style="padding:6px 0;color:#94a3b8;">Booking ID</td><td style="padding:6px 0;font-family:monospace;">${data.bookingId || 'N/A'}</td></tr>
            </table>
          </div>
          <div style="border-top:1px solid rgba(255,255,255,0.1);padding:16px 24px;font-size:12px;color:#64748b;">
            Sent automatically by Aman.
          </div>
        </div>`;

      GmailApp.sendEmail(
        'amandesignpartner@gmail.com',
        'New Zoom Meeting Booked – ' + (data.clientName || 'Client'),
        emailBody,
        { htmlBody: htmlBody }
      );
    } catch (mailErr) {
      // Non-fatal: log but don't fail
      console.error('Zoom email failed:', mailErr.toString());
    }

    return { status: "success", message: existingRowIdx !== -1 ? "Zoom meeting updated" : "Zoom meeting booked" };

  } catch (err) {
    return { status: "error", message: "Zoom booking error: " + err.toString() };
  }
}

/**
 * Returns Zoom meeting data for a given Booking ID (for two-way sync from Sheet back to site).
 */
function getZoomMeetingById(bookingId) {
  try {
    const sheet = getZoomSheet();
    const rows  = sheet.getDataRange().getValues();
    const bid   = bookingId.toString().trim().toUpperCase();

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0].toString().trim().toUpperCase() === bid) {
        return {
          status: "success",
          meeting: {
            bookingId:       rows[i][0],
            clientName:      rows[i][1],
            clientEmail:     rows[i][2],
            clientTimeZone:  rows[i][3],
            meetingDate:     rows[i][4],
            selectedSlot:    rows[i][5],
            clientLocalTime: rows[i][6],
            pakistanTime:    rows[i][7],
            zoomLink:        rows[i][8],
            bookingStatus:   rows[i][9],
            createdAt:       rows[i][10],
            lastUpdated:     rows[i][11]
          }
        };
      }
    }
    return { status: "error", message: "No Zoom meeting found for Booking ID: " + bookingId };
  } catch (err) {
    return { status: "error", message: "Error fetching Zoom meeting: " + err.toString() };
  }
}

/* ============================= */
/* ===== VISITOR LOG SYNC ====== */
/* ============================= */

function getVisitorLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const VISITOR_SHEET_NAME = 'Website Visitor Logs';
  let sheet = ss.getSheetByName(VISITOR_SHEET_NAME);

  const headers = [
    "Timestamp (PKT)", 
    "IP Address", 
    "Browser & Version", 
    "Device Type", 
    "Operating System", 
    "Country / Region / City", 
    "Page URL visited", 
    "Referrer URL", 
    "Session Duration",
    "Screen Resolution",
    "Language"
  ];

  if (!sheet) {
    sheet = ss.insertSheet(VISITOR_SHEET_NAME);
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold").setBackground("#2c3e50").setFontColor("white");
    sheet.setFrozenRows(1);
    // Set some basic column widths
    sheet.setColumnWidth(1, 150); // Timestamp
    sheet.setColumnWidth(2, 120); // IP
    sheet.setColumnWidth(6, 200); // Geo
    sheet.setColumnWidth(7, 250); // Page URL
  } else {
    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#2c3e50").setFontColor("white");
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

function handleVisitorLog(data) {
  try {
    const sheet = getVisitorLogSheet();
    const now = new Date();
    const timestamp = Utilities.formatDate(now, "GMT+5", "d MMM yyyy HH:mm:ss");

    const rowData = [
      timestamp,
      data.ip || 'Unknown',
      data.browser || 'Unknown',
      data.device || 'Desktop',
      data.os || 'Unknown',
      data.location || 'Unknown',
      data.pageUrl || '',
      data.referrer || 'Direct / None',
      data.sessionDuration || 'N/A',
      data.screenResolution || 'Unknown',
      data.language || 'Unknown'
    ];

    sheet.appendRow(rowData);

    try {
      const emailBody = `Aman You Got New Visitor\n\n` +
        `Time: ${timestamp}\n` +
        `Location: ${data.location || 'Unknown'}\n` +
        `Device: ${data.device || 'Desktop'}\n` +
        `OS: ${data.os || 'Unknown'}\n` +
        `Browser: ${data.browser || 'Unknown'}\n` +
        `IP Address: ${data.ip || 'Unknown'}\n` +
        `Page Visited: ${data.pageUrl || ''}\n` +
        `Referrer: ${data.referrer || 'Direct / None'}\n` +
        `Language: ${data.language || 'Unknown'}\n` +
        `Resolution: ${data.screenResolution || 'Unknown'}`;
        
      GmailApp.sendEmail('aman.designpartner@gmail.com', 'Aman You Got New Visitor', emailBody);
    } catch(e) {
      console.error('Visitor Email failed:', e);
    }

    return { status: "success", message: "Visitor logged successfully" };
  } catch (err) {
    return { status: "error", message: "Error logging visitor: " + err.toString() };
  }
}

/**
 * Automatically delete visitor logs older than 30 days.
 * This function should be set up with a Time-driven trigger (e.g., daily) in Google Apps Script.
 */
function deleteOldVisitorLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Website Visitor Logs');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return; // Only headers or empty

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  // Loop backwards to safely delete rows without affecting subsequent indices
  for (let i = data.length - 1; i > 0; i--) {
    const timestampStr = data[i][0];
    if (timestampStr) {
      let rowDate = new Date(timestampStr);
      
      // Fallback parsing if string format is not recognized by JS Date object directly
      if (isNaN(rowDate.getTime()) && typeof timestampStr === 'string') {
          // Attempt to parse 'd MMM yyyy HH:mm:ss' like '1 Mar 2026 03:19:37'
          const parts = timestampStr.split(' ');
          if (parts.length >= 4) {
              const day = parts[0];
              const month = parts[1];
              const year = parts[2];
              const time = parts[3];
              rowDate = new Date(`${month} ${day}, ${year} ${time}`);
          }
      }

      if (!isNaN(rowDate.getTime())) {
        if (rowDate < thirtyDaysAgo) {
          sheet.deleteRow(i + 1); // 1-indexed row number
        }
      }
    }
  }
}
