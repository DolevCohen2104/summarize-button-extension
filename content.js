// --- Configuration ---
// API logic moved to background.js to bypass CORS constraints 

// --- Initialize Extension UI ---
function initExtension() {
  // Prevent duplicate buttons if the script runs multiple times
  if (document.getElementById('commander-analyze-btn')) return;

  // Create the Floating Action Button (FAB)
  const button = document.createElement('button');
  button.id = 'commander-analyze-btn';
  button.className = 'commander-fab-btn';
  button.innerText = '✨ סכם נתוני צוער';
  
  // Attach the main process to the click event
  button.addEventListener('click', handleAnalyzeClick);
  
  // Inject the button into the page
  document.body.appendChild(button);
}

// --- Data Extraction & Processing ---
function extractData() {
  // Find the exact element required by the task
  const skillsElement = document.querySelector('.skills-grid');
  
  if (!skillsElement) {
    throw new Error('לא נמצא אלמנט עם הקלאס .skills-grid בעמוד.');
  }

  // Retrieve the JSON string from the data-charts attribute
  const dataChartsAttr = skillsElement.getAttribute('data-charts');
  
  if (!dataChartsAttr) {
    throw new Error('לא נמצא Attribute בשם data-charts באלמנט.');
  }

  let jsonData;
  try {
    // Parse the attribute string to a JSON object
    jsonData = JSON.parse(dataChartsAttr);
  } catch (e) {
    throw new Error('שגיאה בפענוח נתוני ה-JSON מה-Attribute.');
  }

  if (!Array.isArray(jsonData)) {
    throw new Error('הנתונים אינם במבנה של מערך כנדרש.');
  }

  // Process data into a formatted string
  let processedDataString = 'נתוני צוער מפורטים:\n';
  
  // Translation map for trends
  const trendTranslations = {
    'stable': 'יציב',
    'fluctuating': 'תנודתי',
    'improving': 'במגמת עליה',
    'declining': 'במגמת ירידה'
  };

  jsonData.forEach(skill => {
    // Validate entry fields
    if (!skill.skillName || !Array.isArray(skill.data) || skill.data.length === 0) {
      return; 
    }
    
    // Calculate historical average
    const sum = skill.data.reduce((acc, val) => acc + val, 0);
    const avg = (sum / skill.data.length).toFixed(2);
    
    // Get latest score
    const lastScore = skill.data[skill.data.length - 1];
    
    // Translate trend to Hebrew
    const translatedTrend = trendTranslations[skill.trend?.toLowerCase()] || skill.trend || 'לא ידוע';

    // Construct a specific string for each skill
    processedDataString += `- [${skill.skillName}]: ממוצע ציונים ${avg}/5, ציון אחרון ${lastScore}/5. מגמה: ${translatedTrend}\n`;
  });

  return processedDataString;
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
    showModal(summary);

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
function showModal(content) {
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
  overlay.appendChild(modalContent);

  // Inject modal into document body
  document.body.appendChild(overlay);
}

// Initialize when the DOM tree has built
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}
