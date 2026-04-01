const API_URL = 'https://summarize-button-extension-qroc3dift.vercel.app/api/generate'; 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchSummary') {
    
    // Perform fetch request from background script to bypass Content Script CORS restrictions in MV3
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // 'Authorization': 'Bearer <TOKEN>' // Uncomment and use if API requires auth
      },
      body: JSON.stringify({ prompt: request.prompt })
    })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`שגיאת שרת אירעה: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      // Parse the textual response assuming general LLM API structure formats
      const summary = data.summary || data.text || data.response || data.choices?.[0]?.text || data.generated_text || 'התקבלה תשובה תקינה אך ריקה מהשרת.';
      sendResponse({ success: true, data: summary });
    })
    .catch((error) => {
      console.error('Background API Error:', error);
      sendResponse({ success: false, error: 'שגיאה בתקשורת מול שרת ה-LLM. נא לבדוק חיבור, הרשאות ואת כתובת ה-API.' });
    });

    // Return true to indicate we will send a response asynchronously
    return true;
  }
});
