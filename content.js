// --- Configuration ---
// API logic moved to background.js to bypass CORS constraints 

// --- Initialize Extension UI ---
function injectButtonIfNeeded() {
  const existingButton = document.getElementById('commander-analyze-btn');
  const skillsGridExists = !!document.querySelector('.skills-grid');

  if (skillsGridExists && !existingButton) {
    // Create the Floating Action Button (FAB)
    const button = document.createElement('button');
    button.id = 'commander-analyze-btn';
    button.className = 'commander-fab-btn';
    button.innerText = '✨ סכם נתוני צוער';
    
    // Attach the main process to the click event
    button.addEventListener('click', handleAnalyzeClick);
    
    // Inject the button into the page
    document.body.appendChild(button);
  } else if (!skillsGridExists && existingButton) {
    // Remove the button if the user navigated away from the cadet profile
    existingButton.remove();
  }
}

function initExtension() {
  // Initial check on load
  injectButtonIfNeeded();

  // Set up an observer to watch for dynamic page navigations (AJAX/SPA behavior in Moodle)
  const observer = new MutationObserver(() => {
    injectButtonIfNeeded();
  });
  
  // Start observing the body for injected nodes
  observer.observe(document.body, { childList: true, subtree: true });
}

// --- Data Extraction & Processing ---
function extractData() {
  // חיפוש האלמנט בעמוד
  const skillsElement = document.querySelector('.skills-grid');
  
  if (!skillsElement) {
    throw new Error('לא נמצא אלמנט עם הקלאס .skills-grid בעמוד.');
  }

  // שליפת המחרוזת של ה-JSON
  const dataChartsAttr = skillsElement.getAttribute('data-charts');
  
  if (!dataChartsAttr) {
    throw new Error('לא נמצא Attribute בשם data-charts באלמנט.');
  }

  let rawData;
  try {
    rawData = JSON.parse(dataChartsAttr);
  } catch (e) {
    throw new Error('שגיאה בפענוח נתוני ה-JSON מה-Attribute.');
  }

  if (!Array.isArray(rawData)) {
    throw new Error('הנתונים אינם במבנה של מערך כנדרש.');
  }

  // ניקוי הנתונים: השארת המידע הקריטי בלבד למודל
  const cleanData = rawData.map(skill => {
    return {
      skillName: skill.skillName,
      scores: skill.data, // רצף הציונים המלא - קריטי כדי לזהות תהליך למידה או שבירה
      trend: skill.trend,
      simulations: skill.simulationNames // קריטי כדי להבין באיזה הקשר הושג הציון (שטח מול שגרה)
    };
  });

  // החזרת הנתונים כמחרוזת JSON מסודרת ונקייה שמוכנה להיכנס לפרומפט
  console.log(JSON.stringify(cleanData, null, 2));
  return JSON.stringify(cleanData, null, 2);
}

// --- API Request ---
async function fetchSummaryFromLLM(extractedDataString) {
  // המערכת (System Prompt) מוגדרת בשרת Vercel. 
  // כאן מהתוסף אנחנו שולחים נטו את הנתונים הגולמיים כ-User Prompt.
  const prompt = `להלן נתוני הצוער שחולצו מתוך הסימולטור כעת:\n\n${extractedDataString}`;

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'fetchSummary', prompt: prompt },
      (response) => {
        // If extension context was invalidated or background script not reachable
        if (chrome.runtime.lastError) {
          console.error('Runtime Error:', chrome.runtime.lastError);
          return reject(new Error('שגיאה בתקשורת מול הרקע של התוסף. נא לרענן את העמוד ולנסות שוב.'));
        }
        
        // Handle success/failure from the background worker
        if (response && response.success) {
          resolve(response.data);
        } else {
          console.error('API Error via Background:', response?.error);
          reject(new Error(response?.error || 'שגיאה בתקשורת מול שרת ה-LLM. נא לבדוק חיבור, הרשאות ואת כתובת ה-API.'));
        }
      }
    );
  });
}

// --- Main Trigger Handler ---
async function handleAnalyzeClick() {
  const button = document.getElementById('commander-analyze-btn');
  const originalText = button.innerText;

  try {
    // 1. Set UI state to Loading
    button.disabled = true;
    button.innerText = '⏳ מנתח נתונים...';

    // 2. Extract Data from DOM
    const extractedData = extractData();
    
    if (extractedData === 'נתוני צוער מפורטים:\n') {
       throw new Error('לא נמצאו נתונים קריאים במערך.');
    }

    // 3. Call the Internal LLM API
    const summary = await fetchSummaryFromLLM(extractedData);

    // 4. Show insights in Modal overlay
    showModal(summary, extractedData);

  } catch (error) {
    alert(`שגיאה בביצוע הפעולה:\n${error.message}`);
  } finally {
    // 5. Restore button original state
    if (button) {
      button.innerText = originalText;
      button.disabled = false;
    }
  }
}

// --- Modal rendering logic ---
function showModal(content, extractedData) {
  // Clear any existing modal
  const existingOverlay = document.getElementById('commander-modal-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay encompassing entire screen
  const overlay = document.createElement('div');
  overlay.id = 'commander-modal-overlay';
  overlay.className = 'commander-modal-overlay';

  // Create content box
  const modalContent = document.createElement('div');
  modalContent.className = 'commander-modal-content';

  // Modal Header/Title
  const title = document.createElement('h2');
  title.className = 'commander-modal-title';
  title.innerText = '💡 תובנות לשיחת חתך';

  // Modal body / Text content
  const textBody = document.createElement('div');
  textBody.className = 'commander-summary-text';
  textBody.innerText = content; // Rendering properly via pre-wrap

  // PDF Print Button
  const pdfBtn = document.createElement('button');
  pdfBtn.className = 'commander-pdf-btn';
  pdfBtn.innerText = '📥 הורד כדו"ח (PDF)';
  pdfBtn.onclick = () => {
    generatePDF(content, extractedData);
  };

  // Modal Dismiss Button
  const closeButton = document.createElement('button');
  closeButton.className = 'commander-modal-close';
  closeButton.innerHTML = '&times;'; // Render 'X' Symbol
  closeButton.title = 'סגור רובריקה';
  closeButton.onclick = () => {
    overlay.remove();
  };

  // Close when clicking directly on overlay background
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  // Assemble the DOM structure
  modalContent.appendChild(closeButton);
  modalContent.appendChild(title);
  modalContent.appendChild(textBody);
  modalContent.appendChild(pdfBtn);
  overlay.appendChild(modalContent);

  // Inject modal into document body
  document.body.appendChild(overlay);
}

// --- Cadet Name Extraction ---
function extractCadetName() {
  // The cadet's name appears as the last breadcrumb item in the page header
  // e.g. <li class="breadcrumb-item"><div class="item-text">דוח התפתחות אישי: דולב כהן</div></li>
  const breadcrumbItems = document.querySelectorAll('#page-navbar .breadcrumb-item .item-text');
  if (breadcrumbItems.length === 0) return null;
  
  const lastItem = breadcrumbItems[breadcrumbItems.length - 1];
  const text = lastItem.textContent.trim();
  
  // Extract the name after the colon: "דוח התפתחות אישי: דולב כהן" -> "דולב כהן"
  const colonIndex = text.lastIndexOf(':');
  if (colonIndex !== -1) {
    return text.substring(colonIndex + 1).trim();
  }
  
  return text; // fallback: return the whole text if no colon found
}

// --- PDF Download Logic ---
function generatePDF(summaryText, rawData) {
  const cadetName = extractCadetName() || 'לא ידוע';
  const dateStr = new Date().toLocaleDateString('he-IL');
  const fileName = `דוח_פיקודי_${cadetName.replace(/\s+/g, '_')}.pdf`;

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #222;
      line-height: 1.7;
      direction: rtl;
      text-align: right;
      padding: 40px;
      background: white;
    }
    .print-btn {
      display: block;
      margin: 0 auto 30px auto;
      padding: 12px 32px;
      background: #005A32;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      font-family: inherit;
    }
    .print-btn:hover { background: #003d22; }
    @media print { .print-btn { display: none !important; } }
    .report-header {
      text-align: center;
      border-bottom: 3px solid #005A32;
      padding-bottom: 14px;
      margin-bottom: 28px;
    }
    .report-header h1 { color: #005A32; font-size: 28px; }
    .report-header h3 { color: #555; font-size: 15px; margin-top: 6px; }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      font-size: 15px;
      font-weight: bold;
    }
    .meta-field {
      border-bottom: 1px dotted #888;
      padding-bottom: 4px;
      min-width: 220px;
    }
    .section-title {
      background: #f0f4f2;
      padding: 8px 14px;
      border-right: 4px solid #005A32;
      font-size: 17px;
      font-weight: bold;
      margin-bottom: 14px;
      margin-top: 24px;
    }
    .content-box {
      white-space: pre-wrap;
      font-size: 14px;
      padding: 10px 14px;
    }
    .raw-data {
      font-size: 12px;
      color: #555;
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">📥 שמור כ-PDF</button>

  <div class="report-header">
    <h1>דו"ח ניתוח פיקודי</h1>
    <h3>מערכת סימולטור מפקדים</h3>
  </div>

  <div class="meta-row">
    <div class="meta-field">שם הצוער: ${cadetName}</div>
    <div class="meta-field">תאריך: ${dateStr}</div>
  </div>

  <div class="section-title">תובנות ויעדים אופרטיביים (בינה מלאכותית)</div>
  <div class="content-box">${summaryText}</div>

  <div class="section-title">נתוני סימולטור גולמיים ששימשו לניתוח</div>
  <div class="content-box raw-data">${rawData}</div>
</body>
</html>`;

  // Open a new tab with the report and auto-trigger print
  const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  
  if (!tab) {
    alert('אנא אפשר חלונות קופצים (Popups) עבור אתר זה כדי לייצא את הדוח.');
    URL.revokeObjectURL(url);
    return;
  }

  // Revoke the blob URL after a delay to free memory
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Initialize when the DOM tree has built
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}
