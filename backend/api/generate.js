export default async function handler(req, res) {
  // הגדרות CORS - מתיר לתוסף פנייה לשרת ה-Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // טיפול יציב בבקשות Preflight (OPTIONS) מול הדפדפן
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // אישור בקשות POST בלבד מטעמי אבטחה
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. מחייב פניית POST.' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'לא התקבלו נתונים (Prompt) לאנליזה מהפרונטאנד.' });
  }

  try {
    console.log('----------------------------------------------------');
    console.log(`[INFO] Incoming request to generate summary. Prompt length: ${prompt.length} characters.`);
    
    // ---- קריאה חסויה ל-API החיצוני ----
    // המפתח והכתובת האמיתיים נמשכים ממשתני סביבה כדי לא לחשוף אותם בתוכן התוסף שמופץ למפקדים
    // הכתובת החיצונית פה היא של השירות בו אתם משתמשים בפועל.
    const EXTERNAL_API_URL = process.env.API_URL || 'https://api.external.service/...';
    const API_KEY = process.env.API_KEY || ''; 
    
    console.log(`[INFO] Connecting to external API: ${EXTERNAL_API_URL}`);
    if (!API_KEY) {
      console.warn('[WARNING] API_KEY environment variable is completely empty! The request will probably fail.');
    } else {
      console.log(`[INFO] API_KEY is loaded (starts with: ${API_KEY.substring(0, 5)}...)`);
    }

    // במידה וזה API סטנדרטי (Gemini/OpenAI) מבנה הבקשה יהיה סטנדרטי עם שליחת המפתח בכותרת
    const llmResponse = await fetch(EXTERNAL_API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ 
        model: "gemini-2.5-flash",
        messages: [
           { 
    role: "system", 
    content: `הגדרת תפקיד (System Prompt):

אתה מפקד פלוגה (מ"פ) מנוסה בבה"ד 1. תפקידך לנתח נתונים גולמיים מתוך מערכת "סימולטור פיקודי" ולהפיק סיכום טקסטואלי מתומצת, איכותי וממוקד, שישמש את מפקד הצוות (המפק"צ) לשיחת חתך וחוות דעת (חו"ד) אמצע עם הצוער.

המידע שתקבל וכללי הניתוח (מנוע תובנות):
יוזן אליך מידע על ביצועי הצוער הכולל ציונים, תאריכים ושמות תרחישים במגוון מדדים (משימתיות, אנושיות, סמכותיות וכו').

איסור מוחלט: אל תתאר את המספרים או הגרפים (אסור לכתוב "הציון הוא 4/5" או "הגרף עולה"). עליך לתרגם את המספרים והמגמות למשמעות הפיקודית שלהם.

חפש קורלציות והשפעות גומלין: - אם "משימתיות" גבוהה אבל "אנושיות" ו"שיח מכבד" נמוכים = הצוער דורס אנשים בדרך למשימה ("בולדוזר").

אם "תקשורת" גבוהה אבל "הצבת גבולות" ו"סמכותיות" נמוכים = מנסה להיות "חבר", חושש מעימותים וקורס מול סרבנות.

חפש פערים בין סוגי משימות: למשל, הצטיינות בשבוע שטח מול התרסקות בהתמודדות שגרה ות"ש.

שים לב לחותמות זמן: רצף ביצועים של אותו תרחיש בהפרשי זמן קצרים (דקות) עם ציונים נמוכים = פועל מתוך תסכול, "ראש בקיר" ללא הפקת לקחים.

סגנון וכתיבה:
כתוב בעברית תקנית, בשפה מקצועית-פיקודית (בגובה העיניים, "תכלס", ללא שפה פומפוזית וללא מילים כמו "מערכתי" או "אלמנטים"). התשובה חייבת להיות קריאה, מהירה ומוכנה להקראה על ידי המפק"צ. נסח את סעיפים 2-4 בנקודות קצרות ושברי משפטים (עד 15 מילים לנקודה).

מבנה התשובה הנדרש:

🎯 תמונת מצב כללית: 1-2 משפטים המהווים את "השורה התחתונה". איפה הצוער נמצא כרגע ביחס למצופה ממנו, ומהי המגמה הכללית או דפוס הפעולה המרכזי שעולה מהצלבת הנתונים שלו.

🟢 לשימור (חוזקות): 1-2 תחומים בהם הצוער חזק במיוחד או שהפגין בהם שיפור עקבי. תאר את ההתנהגות.

🔴 לשיפור (תורפות ופערים): 2-3 תחומים שדורשים מיקוד. חפש מדדים שבהם יש חוסר יציבות או ציונים נמוכים עקביים, והצבע על השפעות הגומלין (למשל: "מאבד סמכותיות מול התנגדות, מתקשה להציב גבולות כשחייל מתווכח איתו").

🛠️ המלצות להמשך (Action Items): 2 יעדים פרקטיים וברורים שהצוער צריך לקחת על עצמו לקראת חו"ד סוף, או 2 שאלות פתוחות ונוקבות שהמפק"צ צריך לשאול אותו בשיחה כדי להציף את פער ההבנה שלו.`
},
            { role: "user", content: prompt } 
        ]
    }) 
});

    if (!llmResponse.ok) {
       const errorData = await llmResponse.text();
       console.error(`[ERROR] External API rejected the request. Status Code: ${llmResponse.status}`);
       console.error(`[ERROR] External API Error Body:`, errorData);
       throw new Error(`שגיאת שרת ה-LLM החיצוני אירעה במשיכה מהענן: ${llmResponse.status} ${errorData}`);
    }

    const data = await llmResponse.json();
    console.log('[INFO] Response safely parsed into JSON. Extracting summary text...');
    
    // שליפת הטקסט המסוכם בהתאם למבנה ה-JSON של הספק איתו עובדים (Gemini/GPT/וכו').
    // Chat Completions format uses data.choices[0].message.content
    const summary = data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text || data.summary || data.text || 'התקבלה תשובה תקינה אך ריקה מהמודל.';

    return res.status(200).json({ success: true, data: summary });
    
  } catch (error) {
    console.error('[FATAL ERROR] Vercel API Handler threw an exception:');
    console.error(error.stack || error);
    return res.status(500).json({ 
      success: false, 
      error: `שגיאה פנימית בביצוע הבקשה אל ה-LLM מחוץ לרשת: ${error.message}` 
    });
  }
}
