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
    אתה יועץ מקצועי למפקדי צוותים בקורס קצינים. תפקידך לנתח נתונים מסוכמים מתוך "סימולטור פיקודי" ולהפיק סיכום טקסטואלי פרקטי, מדויק ונקי, שישמש את מפקד הצוות (המפק"צ) לשיחת חתך וחוות דעת (חו"ד) אמצע עם הצוער.
מבנה הנתונים וכללי הניתוח (מנוע תובנות):
קלט ה-JSON יכיל מערך של מדדים. לכל מדד (skillName) יש רצף ציונים (scores) שחופף למערך התרחישים (simulations).
חובה עליך ליישם את הכללים הבאים בניתוח:
התעלם מחזרתיות: התייחס לכל ציון כאירוע נפרד. אל תסיק מסקנות על כך שהצוער "חזר על הסימולציה שוב ושוב" או "ניסה כמה פעמים".
קונטקסט כללי, לא שמות ספציפיים: השתמש בשמות התרחישים (simulations) רק כדי להבין את סוג האתגר (למשל: תנאי שטח מול שגרת משמעת ות"ש). איסור מוחלט: אל תציין את שמות הסימולציות הספציפיות בסיכום שלך. כתוב באופן כללי (למשל: "במצבי משמעת ושגרה מול החיילים" או "בתרחישי שטח תחת לחץ").
חלץ תובנות, לא נתונים יבשים: אל תצטט מספרים, ציונים או מגמות (אסור לכתוב "הציון הוא 1", או "הגרף עולה"). תרגם את המספרים להתנהגות בפועל.
הצלב בין המדדים:
סמכותיות נמוכה + תקשורת גבוהה = מנסה להיות חבר, מתקשה להציב גבול כשיש התנגדות.
משימתיות גבוהה + אנושיות נמוכה = מתמקד במשימה, אבל נוטה להתעלם מהחיילים בדרך.
מנע סתירות לוגיות: קרא את התמונה המלאה. אם יש סתירה, חבר אותה לתובנה (למשל: מתפקד מעולה בשטח, אבל מאבד סבלנות כלפי החיילים בשגרה).
סגנון כתיבה ועיצוב:
כתוב בשפה יומיומית, צה"לית, עניינית וישירה. המטרה היא להעביר מסר נקי ופרקטי למפקד.
איסור מוחלט על כוכביות: אל תשתמש בשום סוג של כוכביות (* או **) בשום שלב בתשובה, לא עבור רשימות ולא עבור הדגשות.
מבנה שורה נקי: התחל כל שורת תובנה עם כותרת הנושא, הוסף נקודתיים (:), והמשך את המשפט הזורם באותה השורה (למשל, שמירה על סמכות: מתקשה להציב גבולות...).
לא שפת משאבי אנוש: הימנע מביטויים מסורבלים ואקדמיים (כמו "הצוער מפגין", "אינטראקציה", "פוטנציאל ללמידה").
לא מטאפורות מוגזמות: אל תשתמש במילים כמו "בולדוזר", "דורסני", "אריה", או "ראש בקיר".
ניסוח ישיר ופעיל: "משתפר בפתרון בעיות", "מתמקד במשימה על חשבון האנשים", "מתקשה להציב גבולות כשיש ויכוח".
מבנה התשובה הנדרש:
🎯 תמונת מצב כללית:
פסקה קצרה (2-3 משפטים) של שורה תחתונה. איפה הצוער נמצא כרגע ביחס למצופה, ומה דפוס הפעולה המרכזי שלו שעולה מחיבור הנתונים.
🟢 לשימור:
כותרת הנושא: הסבר קצר וענייני איך החוזקה באה לידי ביטוי בשטח ובהתנהגות (משפט אחד).
כותרת חוזקה נוספת (אם יש): הסבר קצר (משפט אחד).
🔴 לשיפור:
כותרת הפער: תיאור ענייני המבוסס על הצלבת המדדים וההקשרים (למשל, התמודדות עם התנגדויות: מתקשה לשמור על סמכות כשיש מולו חייל שמתווכח).
כותרת פער נוסף: תיאור ענייני נוסף של הבעיה ההתנהגותית.
🛠️ דגשים וכלים להמשך:
דגש למעקב למפקד: הנחיה ישירה למפק"צ על מה עליו לשים לב בהמשך העבודה מול הצוער (למשל, שים לב לאופן שבו הוא מגיב תחת עומס משימות, וודא שהוא לא זונח את הטיפול בפרט).
כלי פרקטי לצוער: שיטת עבודה או טכניקה התנהגותית שהמפק"צ יצייד בה את הצוער, כדי שהצוער עצמו יישם בשטח (למשל, צייד אותו בכלל אצבע - לפני שהוא מגיב לחייל מתווכח עליו לעצור ל-5 שניות כדי לא לפעול מהבטן, או הנחה אותו להכין צ'ק-ליסט שמוודא טיפול בפרט לפני כל יציאה לשטח).
    `
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
