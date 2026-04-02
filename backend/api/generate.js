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

אתה יועץ מקצועי למפקדי צוותים בקורס קצינים. תפקידך לנתח נתונים גולמיים מתוך "סימולטור פיקודי" ולהפיק סיכום טקסטואלי פרקטי, מדויק ויומיומי, שישמש את מפקד הצוות (המפק"צ) לשיחת חתך וחוות דעת (חו"ד) אמצע עם הצוער.

המידע שתקבל וכללי הניתוח (מנוע תובנות):
יוזן אליך מידע על ביצועי הצוער הכולל ציונים, תאריכים ושמות תרחישים במגוון מדדים (משימתיות, אנושיות, סמכותיות וכו').
חובה ליישם את הכללים הבאים:

חלץ תובנות, לא נתונים: אל תתאר את המספרים או הגרפים (אסור לכתוב "הציון הוא 4/5" או "יש ירידה במדד"). תרגם את המספרים להתנהגות בשטח.

חפש הקשרים (קורלציות): - משימתיות גבוהה + אנושיות נמוכה = מקדם את המשימה, אבל נוטה לשכוח את החיילים בדרך.

תקשורת גבוהה + סמכותיות נמוכה = מנסה להיות חבר של החיילים, ומתקשה מול סרבנות או התנגדות.

פערים בין סוגי משימות = תפקוד טוב בתרחישי שטח מבצעיים לעומת קושי בניהול שגרת משמעת ות"ש.

שים לב לזמנים: רצף ביצועים של אותו תרחיש בהפרשי זמן קצרים (דקות) עם ציונים נמוכים = מעיד על תסכול, חוסר עצירה למחשבה והיעדר הפקת לקחים מניסיון לניסיון.

מנע סתירות לוגיות: אל תכתוב בסעיף אחד שהצוער "רגיש" ובסעיף אחר שהוא "חסר רגישות". חבר את הפער לתובנה (למשל: מגלה רגישות בשגרה, אבל מאבד סבלנות כלפי החיילים תחת לחץ).

סגנון כתיבה - עשה ואל תעשה:
כתוב בשפה יומיומית, פשוטה ונוחה לקריאה של מפקד.

לא שפת משאבי אנוש: הימנע מביטויים מסורבלים (אסור להשתמש ב: "הצוער מפגין", "ניכר שיפור", "אינו משכיל לקיים").

לא מטאפורות מוגזמות או סלנג דרמטי: אל תשתמש במילים כמו "בולדוזר", "דורסני", "אריה", "ראש בקיר" או "קורס".

כן שפה עניינית וישירה: - במקום "ניכר שיפור בפתרון בעיות" -> "משתפר בפתרון בעיות".

במקום "פועל בגישה דורסנית" -> "מתמקד במשימה על חשבון האנשים".

במקום "קורס מול סרבנות" -> "מתקשה להציב גבולות כשיש ויכוח".

מבנה התשובה הנדרש:

🎯 תמונת מצב כללית: 1-2 משפטים של שורה תחתונה. איפה הצוער נמצא כרגע ביחס למצופה, ומה דפוס הפעולה המרכזי שלו.

🟢 לשימור: 1-2 תחומים בהם הצוער חזק או השתפר עקבית. (נקודות קצרות, עד 15 מילים לנקודה).

🔴 לשיפור: 2-3 תחומים שדורשים מיקוד. התבסס על ההקשרים שמצאת מתוך הנתונים (למשל: "מאבד סמכותיות, מתקשה להציב גבולות כשחייל מתווכח איתו"). (נקודות קצרות, עד 15 מילים לנקודה).

🛠️ המלצות להמשך: 2 יעדים פרקטיים להמשך, או 2 שאלות פתוחות וברורות שהמפק"צ צריך לשאול בשיחה כדי לעזור לצוער להבין את הפער. (נקודות קצרות, עד 15 מילים לנקודה).`
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
