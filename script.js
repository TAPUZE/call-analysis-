// --- Global Variables & Initial Setup ---
let geminiApiKey = ""; 
// DOM elements will be assigned in DOMContentLoaded
let apiKeyStatusElement, processingStatus, transcriptionInput, modal, modalTitle, 
    geminiResponseContent, geminiLoadingIndicator, geminiError, 
    additionalContextInput, reevaluationStatus, calendarSuggestionsContent;

// Note: 'advancedAnalysisPrompt' is now expected to be defined globally 
// by including prompts.js BEFORE this script in index.html.
// We'll check for its existence more robustly in DOMContentLoaded.


// --- Initialize Page ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements now that the DOM is loaded and parsed
    apiKeyStatusElement = document.getElementById('apiKeyStatus');
    processingStatus = document.getElementById('processingStatus');
    transcriptionInput = document.getElementById('transcriptionInput');
    modal = document.getElementById('geminiResponseModal');
    modalTitle = document.getElementById('modalTitle');
    geminiResponseContent = document.getElementById('geminiResponseContent');
    geminiLoadingIndicator = document.getElementById('geminiLoadingIndicator');
    geminiError = document.getElementById('geminiError');
    additionalContextInput = document.getElementById('additionalContextInput');
    reevaluationStatus = document.getElementById('reevaluation-status');
    calendarSuggestionsContent = document.getElementById('calendar-suggestions-content');

    const generationDateElement = document.getElementById('generation-date');
    if (generationDateElement) {
        generationDateElement.textContent = 'תאריך הפקה: ' + new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    if (typeof advancedAnalysisPrompt === 'undefined') {
        console.error("CRITICAL ERROR: advancedAnalysisPrompt is not defined. Make sure prompts.js is loaded before script.js and that the variable is correctly defined in prompts.js.");
        if (processingStatus) { // Check if processingStatus element exists
            processingStatus.textContent = "שגיאה קריטית: קובץ ההנחיות (prompts.js) לא נטען כראוי או שהמשתנה advancedAnalysisPrompt אינו מוגדר בו. בדוק את הקונסול.";
            processingStatus.className = "mt-3 text-sm text-red-500 font-bold";
        } else {
            // Fallback if processingStatus itself isn't found (though it should be)
            alert("שגיאה קריטית בטעינת הנחיות AI. בדוק את הקונסול.");
        }
    }

    loadApiKey();
    setupUIEventListeners();
});


// --- API Key Management ---
function setApiKey() {
    const inputKeyElement = document.getElementById('apiKeyInput');
    if (!inputKeyElement) {
        console.error("API Key input element not found.");
        return; 
    }

    const inputKey = inputKeyElement.value;
    if (inputKey && inputKey.trim() !== "") {
        geminiApiKey = inputKey.trim();
        localStorage.setItem('geminiReportApiKey', geminiApiKey);
        if (apiKeyStatusElement) {
            apiKeyStatusElement.textContent = "סטטוס: מפתח API הוגדר והוא ישמר לדפדפן זה.";
            apiKeyStatusElement.className = "text-xs mt-1 text-green-600";
        }
    } else {
        localStorage.removeItem('geminiReportApiKey');
        geminiApiKey = "";
        if (apiKeyStatusElement) {
            apiKeyStatusElement.textContent = "סטטוס: לא הוגדר. הזן מפתח כדי להשתמש בתכונות AI.";
            apiKeyStatusElement.className = "text-xs mt-1 text-red-500";
        }
    }
}

function loadApiKey() {
    const storedKey = localStorage.getItem('geminiReportApiKey');
    const apiKeyInputElement = document.getElementById('apiKeyInput');

    if (storedKey) {
        geminiApiKey = storedKey;
        if (apiKeyInputElement) apiKeyInputElement.value = storedKey; 
        if (apiKeyStatusElement) {
            apiKeyStatusElement.textContent = "סטטוס: מפתח API נטען מהאחסון המקומי.";
            apiKeyStatusElement.className = "text-xs mt-1 text-blue-600";
        }
    } else {
        if (apiKeyStatusElement) {
             apiKeyStatusElement.textContent = "סטטוס: לא הוגדר. הזן מפתח כדי להשתמש בתכונות AI.";
             apiKeyStatusElement.className = "text-xs mt-1 text-red-500";
        }
    }
}

// --- Core AI Processing for New Call ---
async function processNewCall() {
    if (!transcriptionInput) {
        console.error("Transcription input element not found.");
        if(processingStatus) {
            processingStatus.textContent = "שגיאה: רכיב קלט התמלול לא נמצא.";
            processingStatus.className = "mt-3 text-sm text-red-500";
        }
        return;
    }
    const transcriptionText = transcriptionInput.value.trim();

    if (typeof advancedAnalysisPrompt === 'undefined') { 
        if(processingStatus) {
            processingStatus.textContent = "שגיאה קריטית: הנחיית ה-AI הראשית אינה מוגדרת.";
            processingStatus.className = "mt-3 text-sm text-red-500";
        }
        console.error("advancedAnalysisPrompt is undefined in processNewCall.");
        return;
    }

    if (!geminiApiKey) {
        if(processingStatus) {
            processingStatus.textContent = "שגיאה: מפתח Gemini API לא הוגדר. אנא הזן אותו למעלה.";
            processingStatus.className = "mt-3 text-sm text-red-500";
        }
        return;
    }
    if (!transcriptionText) {
        if(processingStatus) {
            processingStatus.textContent = "שגיאה: אנא הדבק תמלול שיחה.";
            processingStatus.className = "mt-3 text-sm text-red-500";
        }
        return;
    }

    if(processingStatus) {
        processingStatus.textContent = "מעבד תמלול... זה עשוי לקחת מספר רגעים.";
        processingStatus.className = "mt-3 text-sm text-blue-600";
    }
    openModal("🤖 מעבד ניתוח שיחה חדשה..."); 

    const promptForFullAnalysis = `${advancedAnalysisPrompt}\n\nהנה תמלול השיחה לניתוח:\n<transcription_text>\n${transcriptionText}\n</transcription_text>\n\nאנא החזר את הניתוח המלא כ-JSON יחיד עם המבנה שצוין למעלה.`;
    
    const payload = {
        contents: [{ role: "user", parts: [{ text: promptForFullAnalysis }] }],
        generationConfig: { responseMimeType: "application/json" }
    };

    let analysisJsonString = ""; 

    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
        }
        const result = await response.json();

        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0].text) {
            analysisJsonString = result.candidates[0].content.parts[0].text;
            let cleanedJsonString = analysisJsonString
                .replace(/,\s*]/g, "]") 
                .replace(/,\s*}/g, "}"); 
            
            const analysisData = JSON.parse(cleanedJsonString);
            populateReportWithData(analysisData); 
            if(processingStatus) {
                processingStatus.textContent = "ניתוח השיחה הושלם והדוח עודכן!";
                processingStatus.className = "mt-3 text-sm text-green-600";
            }
        } else {
            console.error('Unexpected Gemini API response structure for full analysis:', result);
            throw new Error("מבנה תגובה לא צפוי מה-API בעת ניתוח השיחה.");
        }
    } catch (error) {
        console.error("Error processing new call:", error);
        console.error("Problematic JSON string received from API (full analysis):", analysisJsonString); 
        if(processingStatus) {
            processingStatus.textContent = `שגיאה בעיבוד: ${error.message}. בדוק את הקונסול לפרטים נוספים על ה-JSON שהתקבל.`;
            processingStatus.className = "mt-3 text-sm text-red-500";
        }
        if(geminiError) {
            geminiError.textContent = `שגיאה בעיבוד השיחה החדשה: ${error.message}. ה-JSON שהתקבל מה-API הודפס לקונסול הבדיקה (developer console).`;
            geminiError.style.display = 'block';
        }
    } finally {
         closeModal(); 
    }
}

function populateReportWithData(data) {
    const createListItems = (itemsArray, keyToDisplay = null) => {
        if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
            return '<li class="text-gray-500 italic">אין נתונים זמינים.</li>';
        }
        return itemsArray.map(item => {
            let displayItem = '';
            if (typeof item === 'string') {
                displayItem = item.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
            } else if (typeof item === 'object' && item !== null) {
                let textContent = keyToDisplay && item[keyToDisplay] ? item[keyToDisplay] : item.taskDescription || JSON.stringify(item);
                displayItem = String(textContent).replace(/</g, "&lt;").replace(/>/g, "&gt;");
            } else {
                displayItem = 'נתון לא תקין';
            }
            return `<li>${displayItem}</li>`;
        }).join('');
    };

    const createActionListItems = (itemsArray, forAharon = true) => {
         if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) return '<li class="text-gray-500 italic">אין משימות זמינות.</li>';
         return itemsArray.map(item => {
            const taskDescription = (item.taskDescription || 'משימה לא מוגדרת').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            let taskHTML = `<li><strong>${taskDescription}</strong>`;
            if(item.impliedUrgency) taskHTML += `. דחיפות: ${item.impliedUrgency}.`;
            if(item.contextReason) taskHTML += ` (הקשר: ${item.contextReason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}).`;

            const taskDescLower = (item.taskDescription || "").toLowerCase();
            if(forAharon && (taskDescLower.includes('נס מולטימדיה') || taskDescLower.includes('מוזיאון') || taskDescLower.includes('מני') || taskDescLower.includes('נחמן'))) {
                let taskContext = item.contextReason || item.taskDescription.split('עם ')[1] || item.taskDescription; 
                taskHTML += ` <button class="gemini-button ml-2" data-task-context="${taskContext.split('.')[0].trim().replace(/"/g, '&quot;')}" onclick="generateEmailDraft(this)"><i class="fas fa-wand-magic-sparkles"></i> הפק טיוטת מייל</button>`;
            }
            taskHTML += `</li>`;
            return taskHTML;
         }).join('');
    }

    // I. Executive Summary
    const summarySectionContent = document.querySelector('#section-summary .section-content');
    if (data.executiveSummary && summarySectionContent) {
        const es = data.executiveSummary;
        let summaryHTML = `<p class="mb-2"><strong>סוג שיחה:</strong> ${es.callType || 'לא צוין'}</p>`;
        summaryHTML += `<p class="mb-2"><strong>מטרה עיקרית:</strong> ${es.mainPurpose || 'לא צוין'}</p>`;
        if (es.keyOutcomesAndDecisions && es.keyOutcomesAndDecisions.length > 0) {
            summaryHTML += `<p class="mb-1"><strong>החלטות ותוצאות מפתח:</strong></p><ul class="list-disc pr-5">${createListItems(es.keyOutcomesAndDecisions)}</ul>`;
        }
        if (es.criticalRoadblocks && es.criticalRoadblocks.length > 0) {
            summaryHTML += `<p class="mt-2 mb-1"><strong>חסמים/אתגרים קריטיים:</strong></p><ul class="list-disc pr-5">${createListItems(es.criticalRoadblocks)}</ul>`;
        }
        summaryHTML += `<p class="mt-2"><strong>סנטימנט כללי:</strong> ${es.overallSentiment || 'לא צוין'}</p>`;
        summarySectionContent.innerHTML = summaryHTML;
    } else if (summarySectionContent) {
         summarySectionContent.innerHTML = '<p class="text-gray-500 italic">סיכום לא זמין.</p>';
    }

    // II. Action Items
    const aharonTasksUl = document.getElementById('aharon-tasks');
    const kalmanDevTasksUl = document.getElementById('kalman-dev-tasks');
    if (data.actionItems) {
        if(aharonTasksUl) aharonTasksUl.innerHTML = createActionListItems(data.actionItems.forAharon, true);
        if(kalmanDevTasksUl) kalmanDevTasksUl.innerHTML = createActionListItems(data.actionItems.forKalmanDev, false);
    } else {
        if(aharonTasksUl) aharonTasksUl.innerHTML = '<li class="text-gray-500 italic">אין משימות לאהרון.</li>';
        if(kalmanDevTasksUl) kalmanDevTasksUl.innerHTML = '<li class="text-gray-500 italic">אין משימות לקלמן/צוות.</li>';
    }
    
    const sectionMappings = {
        '#section-product-strategy': data.productStrategy,
        '#section-pricing-business-model': data.pricingBusinessModel,
        '#section-target-audience': data.targetAudience,
        '#section-technical-aspects': data.technicalAspects,
        '#section-collaborations-ext': data.collaborationsExternal
    };

    for (const sectionId in sectionMappings) {
        const sectionData = sectionMappings[sectionId];
        const sectionElement = document.querySelector(`${sectionId} .section-content`);
        if (sectionElement) {
            if (sectionData && typeof sectionData === 'object' && Object.keys(sectionData).length > 0) {
                let contentHTML = '';
                for (const key in sectionData) {
                    let titleKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    const translations = {
                        "productsServicesDiscussed": "מוצרים/שירותים שנדונו", "coreFunctionalityMVP": "פונקציונליות ליבה/MVP",
                        "futureDevelopment": "פיתוח עתידי", "uxUiPoints": "נקודות UX/UI",
                        "keyStrengthsUSPs": "חוזקות מרכזיות/USPs", "weaknessesImprovements": "חולשות/אזורים לשיפור",
                        "pricingTiersProposals": "הצעות תמחור", "costConsiderations": "שיקולי עלות",
                        "revenueModelStrategy": "מודל הכנסות", "financialConcernsTargets": "חששות/יעדים פיננסיים",
                        "targetCustomerProfiles": "פרופיל לקוח יעד", "marketSegments": "פלחי שוק",
                        "salesGoToMarket": "אסטרטגיית מכירות/שיווק", "competitorMentionsPositioning": "אזכורי מתחרים/מיצוב",
                        "keyTechnologiesPlatforms": "טכנולוגיות/פלטפורמות מפתח", "technicalBlockersChallenges": "חסמים/אתגרים טכניים",
                        "integrationPoints": "נקודות אינטגרציה", "dataSecurityPrivacy": "אבטחת מידע ופרטיות",
                        "potentialExistingPartners": "שותפים פוטנציאליים/קיימים", "externalResourcesFreelancers": "משאבים חיצוניים/פרילנסרים",
                        "natureOfCollaboration": "אופי השיתוף פעולה/תלות"
                    };
                    titleKey = translations[key] || titleKey;

                    if (Array.isArray(sectionData[key]) && sectionData[key].length > 0) {
                        contentHTML += `<h3>${titleKey}</h3><ul>${createListItems(sectionData[key])}</ul>`;
                    } else if (typeof sectionData[key] === 'string' && sectionData[key]) {
                         contentHTML += `<p><strong>${titleKey}:</strong> ${sectionData[key].replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
                    }
                }
                sectionElement.innerHTML = contentHTML || '<p class="text-gray-500 italic">אין נתונים זמינים לחלק זה.</p>';
            } else {
                sectionElement.innerHTML = '<p class="text-gray-500 italic">אין נתונים זמינים לחלק זה.</p>';
            }
        }
    }
    
    // Key Concerns
    const concernsListElement = document.getElementById('concerns-list');
    if (data.keyConcerns && data.keyConcerns.majorConcernsVoiced && data.keyConcerns.majorConcernsVoiced.length > 0) {
        if(concernsListElement) concernsListElement.innerHTML = createListItems(data.keyConcerns.majorConcernsVoiced);
    } else {
        if(concernsListElement) concernsListElement.innerHTML = '<li class="text-gray-500 italic">אין חששות מרכזיים.</li>';
    }

    // Participant Info
    const participantElement = document.querySelector('#section-participants-roles .section-content');
    if (participantElement) {
        if (data.participantInfo) {
            let participantHTML = '<ul>';
            if (data.participantInfo.participant1Name) { 
                participantHTML += `<li><strong>${data.participantInfo.participant1Name.replace(/</g, "&lt;").replace(/>/g, "&gt;")}:</strong> ${ (data.participantInfo.participant1Role || 'לא צוין תפקיד').replace(/</g, "&lt;").replace(/>/g, "&gt;") }</li>`;
                if (data.participantInfo.participant2Name) {
                    participantHTML += `<li><strong>${data.participantInfo.participant2Name.replace(/</g, "&lt;").replace(/>/g, "&gt;")}:</strong> ${ (data.participantInfo.participant2Role || 'לא צוין תפקיד').replace(/</g, "&lt;").replace(/>/g, "&gt;") }</li>`;
                }
            } else if (data.participantInfo.companyRepresentatives) {
                data.participantInfo.companyRepresentatives.forEach(rep => {
                    participantHTML += `<li><strong>נציג חברה: ${ (rep.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;") }</strong> (${ (rep.role || 'לא צוין תפקיד').replace(/</g, "&lt;").replace(/>/g, "&gt;") })</li>`;
                });
                 if (data.participantInfo.clientExternalInfo) {
                    const client = data.participantInfo.clientExternalInfo;
                    participantHTML += `<li><strong>לקוח/גורם חיצוני: ${ (client.name || '').replace(/</g, "&lt;").replace(/>/g, "&gt;") }</strong> (${ (client.company || '').replace(/</g, "&lt;").replace(/>/g, "&gt;") }, ${ (client.role || '').replace(/</g, "&lt;").replace(/>/g, "&gt;") })</li>`;
                    if(client.needs) participantHTML += `<li><strong>צרכים עיקריים:</strong> ${client.needs.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`;
                }
            }
            participantHTML += '</ul>';
            participantElement.innerHTML = participantHTML.includes('<li>') ? participantHTML : '<p class="text-gray-500 italic">פרטי משתתפים לא זמינים.</p>';
        } else {
            participantElement.innerHTML = '<p class="text-gray-500 italic">פרטי משתתפים לא זמינים.</p>';
        }
    }


    // Important Quotes
    const quotesElement = document.querySelector('#section-quotes .section-content');
    if (data.importantQuotes && data.importantQuotes.length > 0) {
       if(quotesElement) quotesElement.innerHTML = `<ul>${createListItems(data.importantQuotes)}</ul>`;
    } else {
        if(quotesElement) quotesElement.innerHTML = '<p class="text-gray-500 italic">אין ציטוטים חשובים.</p>';
    }

    // People Mentioned Table
    const peopleTableBody = document.querySelector('#people-mentioned-table tbody');
    if (peopleTableBody) {
        if (data.peopleMentionedTable && data.peopleMentionedTable.length > 0) {
            let tableHTML = '';
            data.peopleMentionedTable.forEach(person => {
                tableHTML += `<tr>
                                <td>${(person.nameEntity || '').replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                                <td>${(person.roleContext || '').replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                                <td>${(person.keyInfoAction || '').replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                              </tr>`;
            });
            peopleTableBody.innerHTML = tableHTML;
        } else {
            peopleTableBody.innerHTML = '<tr><td colspan="3" class="text-gray-500 italic text-center">לא הוזכרו אישים/גורמים ספציפיים.</td></tr>';
        }
    }


    // AI Notes
    const aiNotesElement = document.querySelector('#section-ai-notes .section-content');
    if (data.aiNotes && data.aiNotes.length > 0) {
        if(aiNotesElement) aiNotesElement.innerHTML = `<ul>${createListItems(data.aiNotes)}</ul>`;
    } else {
        if(aiNotesElement) aiNotesElement.innerHTML = '<p class="text-gray-500 italic">אין הערות AI.</p>';
    }
    
    if(calendarSuggestionsContent) calendarSuggestionsContent.innerHTML = '<p class="text-gray-500 italic">הצעות ליומן יופיעו כאן...</p>';
    if(additionalContextInput) additionalContextInput.value = '';
    if(reevaluationStatus) reevaluationStatus.textContent = '';

    csvDataPoints.length = 1; 
    if(data.executiveSummary) csvDataPoints.push(["סיכום מנהלים", data.executiveSummary.mainPurpose || ""]);
     if(data.actionItems && data.actionItems.forAharon) data.actionItems.forAharon.forEach(task => csvDataPoints.push(["משימה לאהרון", task.taskDescription]));
    if(data.actionItems && data.actionItems.forKalmanDev) data.actionItems.forKalmanDev.forEach(task => csvDataPoints.push(["משימה לקלמן/צוות", task.taskDescription]));
}


// --- Modal & Gemini API Call Functions ---
function openModal(title) {
    if(modalTitle) modalTitle.textContent = title;
    if(geminiResponseContent) geminiResponseContent.innerHTML = ''; 
    if(geminiError) geminiError.style.display = 'none';
    if(geminiLoadingIndicator) geminiLoadingIndicator.style.display = 'block';
    if(modal) modal.style.display = 'flex';
}

function closeModal() {
    if(modal) modal.style.display = 'none';
}

async function callGeminiAPI(prompt, isJsonOutput = false) { 
    if (!geminiApiKey) {
        openModal("שגיאת מפתח API");
        if(geminiLoadingIndicator) geminiLoadingIndicator.style.display = 'none';
        if(geminiError) {
            geminiError.textContent = "מפתח Gemini API לא הוגדר. אנא הזן אותו באזור ההגדרות של הדף.";
            geminiError.style.display = 'block';
        }
        return Promise.reject("API Key not set");
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
    
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    };
    if (isJsonOutput) {
        payload.generationConfig = { responseMimeType: "application/json" };
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error Response:', errorData);
            throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text; 
        } else {
            console.error('Unexpected Gemini API response structure:', result);
            throw new Error('תוכן לא התקבל מה-API.');
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error; 
    }
}

// --- Feature-Specific Gemini Functions ---
async function generateEmailDraft(buttonElement) {
    const taskItem = buttonElement.closest('li');
    if (!taskItem) return;
    const taskContext = taskItem.dataset.taskContext || taskItem.textContent.split('.')[0].trim(); 
    const callSummaryElement = document.querySelector('#section-summary .section-content p');
    const callSummary = callSummaryElement ? callSummaryElement.textContent : "לא סופק סיכום שיחה עדיין.";
    const productName = "המוצר שלנו לתמלול וניהול שיחות חכם"; 
    const userProvidedContext = additionalContextInput ? additionalContextInput.value.trim() : "";

    openModal(`✨ הפקת טיוטת מייל עבור: ${taskContext}`);

    let prompt = `
        אתה מתפקד כעוזר אישי עבור אהרון.
        המשימה שלך היא לכתוב טיוטת מייל מקצועית וידידותית בעברית.
        הנמען הוא איש קשר בנושא: "${taskContext}".
        מטרת המייל היא ליזום פגישה או המשך שיחה בנושא זה.
        
        הרקע הכללי לשיחה (מסיכום שיחת תכנון פנימית): "${callSummary}"
        שם המוצר/המיזם המרכזי שאהרון וקלמן מפתחים הוא: "${productName}".
        
        במייל, אנא:
        1. הצג את אהרון (אם רלוונטי, ניתן להניח שהייתה היכרות מוקדמת קלה או ששמו הוזכר).
        2. ציין בקצרה את הנושא ("${taskContext}") ואת הרצון לקבוע פגישה/שיחה להרחבה.
        3. אם מתאים, רמוז לערך הפוטנציאלי של "${productName}" עבור הנמען או שיתוף הפעולה.
        4. הצע זמינות לפגישה או בקש מהנמען להציע זמן שנוח לו.
        5. שמור על טון חיובי ומקצועי.
        6. סיום בנימוס עם פרטי יצירת קשר של אהרון (ניתן להשתמש בפרטים גנריים כמו "אהרון | [מספר טלפון] | [כתובת מייל]").
    `;
    if (userProvidedContext) {
        prompt += `\n\nהקשר נוסף שסופק על ידי המשתמש ושחשוב להתייחס אליו בעדינות בטיוטה: "${userProvidedContext}"`;
    }
    prompt += "\n\nאנא ספק רק את גוף המייל, ללא שורת נושא.";

    try {
        const emailDraft = await callGeminiAPI(prompt);
        if(geminiResponseContent) geminiResponseContent.textContent = emailDraft;
    } catch (error) {
        if(geminiResponseContent) geminiResponseContent.textContent = ''; 
        if(geminiError) {
            geminiError.textContent = `אירעה שגיאה בעת הפקת טיוטת המייל: ${error.message}`;
            geminiError.style.display = 'block';
        }
    } finally {
        if(geminiLoadingIndicator) geminiLoadingIndicator.style.display = 'none';
    }
}

async function suggestSolutions() {
    const concernsList = document.getElementById('concerns-list');
    let concernsText = "החששות והסיכונים המרכזיים שזוהו בפרויקט הם:\n";
    if (concernsList && concernsList.children.length > 0 && !concernsList.children[0].classList.contains('italic')) {
         concernsList.querySelectorAll('li').forEach(li => {
            concernsText += `- ${li.textContent.trim()}\n`;
        });
    } else {
        concernsText = "לא זוהו חששות ספציפיים בניתוח הנוכחי.";
    }
   
    const userProvidedContext = additionalContextInput ? additionalContextInput.value.trim() : "";
    
    openModal("✨ הצעת פתרונות לאתגרים");

    let prompt = `
        בהתבסס על רשימת החששות והסיכונים הבאה מפרויקט תוכנה:
        ${concernsText}
    `;
    if (userProvidedContext) {
        prompt += `\n\nהקשר נוסף שסופק על ידי המשתמש ושחשוב להתייחס אליו בהצעת הפתרונות: "${userProvidedContext}"`;
    }
    prompt += `
        אנא הצע 3-5 פתרונות יצירתיים, אסטרטגיות התמודדות, או דרכי פעולה אפשריות לכל אחד מהאתגרים המרכזיים.
        אם לא זוהו חששות, ציין זאת והצע בדיקות כלליות לזיהוי סיכונים בפרויקט חדש.
        התמקד בהצעות פרקטיות וניתנות ליישום. הצג את הפתרונות בצורה מובנית וברורה (למשל, תחת כל חשש, רשימת פתרונות).
    `;

    try {
        const solutions = await callGeminiAPI(prompt);
        if(geminiResponseContent) geminiResponseContent.textContent = solutions;
    } catch (error) {
        if(geminiResponseContent) geminiResponseContent.textContent = '';
        if(geminiError) {
            geminiError.textContent = `אירעה שגיאה בעת הצעת הפתרונות: ${error.message}`;
            geminiError.style.display = 'block';
        }
    } finally {
        if(geminiLoadingIndicator) geminiLoadingIndicator.style.display = 'none';
    }
}

function generateGoogleCalendarLink(title, startDate, endDate, description, location = '') {
    let dateString = '';
    if (startDate && endDate) {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!isNaN(start) && !isNaN(end)) {
                const formatISO = (date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
                dateString = `${formatISO(start)}/${formatISO(end)}`;
            } else { 
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(10, 0, 0, 0); 
                const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000); 
                const formatISO = (date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
                dateString = `${formatISO(tomorrow)}/${formatISO(tomorrowEnd)}`;
                description += "\n(שים לב: התאריך והשעה נקבעו אוטומטית, אנא התאם אותם)";
            }
        } catch (e) { 
             const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(10, 0, 0, 0);
                const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000);
                const formatISO = (date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
                dateString = `${formatISO(tomorrow)}/${formatISO(tomorrowEnd)}`;
                description += "\n(שים לב: התאריך והשעה נקבעו אוטומטית, אנא התאם אותם)";
        }
    } else { 
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0); 
        const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000); 
        const formatISO = (date) => date.toISOString().replace(/-|:|\.\d{3}/g, '');
        dateString = `${formatISO(tomorrow)}/${formatISO(tomorrowEnd)}`;
        description += "\n(שים לב: התאריך והשעה נקבעו אוטומטית, אנא התאם אותם)";
    }

    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);
    const encodedLocation = encodeURIComponent(location);
    
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${dateString}&details=${encodedDescription}&location=${encodedLocation}`;
}

async function getCalendarSuggestions() {
    const aharonTasksList = document.getElementById('aharon-tasks');
    let aharonTasksText = "משימות עיקריות לתיאום פגישות עבור אהרון:\n";
    if (aharonTasksList && aharonTasksList.children.length > 0 && !aharonTasksList.children[0].classList.contains('italic')) {
        aharonTasksList.querySelectorAll('li[data-task-context]').forEach(li => { 
            aharonTasksText += `- ${li.textContent.split('<button')[0].trim()}\n`;
        });
    } else {
         aharonTasksText = "לא זוהו משימות ספציפיות לתיאום פגישות עבור אהרון בניתוח הנוכחי.\n";
    }

    const callSummaryElement = document.querySelector('#section-summary .section-content p');
    const callSummary = callSummaryElement ? callSummaryElement.textContent : "לא סופק סיכום שיחה עדיין.";
    const userProvidedContext = additionalContextInput ? additionalContextInput.value.trim() : "";

    if(calendarSuggestionsContent) calendarSuggestionsContent.innerHTML = `<div class="loading-indicator" style="display:block;"><i class="fas fa-spinner"></i><p>מעבד בקשה...</p></div>`;
    
    let prompt = `
        אתה AI המסייע בתכנון יומן. בהתבסס על סיכום השיחה הבא: "${callSummary}"
        ועל רשימת המשימות הבאה של אהרון ליצירת קשר ותיאום פגישות:
        ${aharonTasksText}
    `;
    if (userProvidedContext) {
        prompt += `\n\nהקשר נוסף שסופק על ידי המשתמש ושחשוב להתייחס אליו בהצעות התזמון: "${userProvidedContext}"`;
    }
    prompt += `
        אנא ספק הצעות תזמון מפורטות בעברית. עבור כל פגישה מרכזית שאהרון צריך לקבוע, ספק את הפרטים הבאים בפורמט JSON. כל אובייקט ב-JSON צריך לייצג פגישה ולהכיל את השדות: "contact_person_or_company", "suggested_title", "suggested_description", "priority" (למשל: "גבוהה", "בינונית", "רגילה"), "suggested_date" (בפורמט YYYY-MM-DD, אם ניתן להסיק או להציע באופן כללי, אחרת null), "suggested_time" (בפורמט HH:MM, אם ניתן, אחרת null), ו-"notes" (הערות נוספות כמו תלויות, קונפליקטים פוטנציאליים, או דחיפות).

        דוגמה לאובייקט JSON עבור פגישה אחת:
        {
            "contact_person_or_company": "נס מולטימדיה",
            "suggested_title": "פגישת היכרות ובחינת שת\\"פ עם נס מולטימדיה",
            "suggested_description": "דיון על המוצר שלנו לתמלול וניהול שיחות, ובחינת אפשרויות לשיתוף פעולה או כלקוח. משתתפים: אהרון, נציג נס מולטימדיה.",
            "priority": "גבוהה",
            "suggested_date": null, 
            "suggested_time": null,
            "notes": "קלמן הדגיש חשיבות גבוהה לקשר זה. יש לתאם בהקדם."
        }

        החזר מערך של אובייקטים כאלה בפורמט JSON. הקפד על תקינות ה-JSON. אם אין משימות רלוונטיות לתזמון, החזר מערך JSON ריק.
    `;
    
    let jsonStringForParsing = "";
    try {
        jsonStringForParsing = await callGeminiAPI(prompt, true); 
        if(calendarSuggestionsContent) calendarSuggestionsContent.innerHTML = ''; 
        const suggestionsArray = JSON.parse(jsonStringForParsing); 

        if (Array.isArray(suggestionsArray) && suggestionsArray.length > 0) {
            suggestionsArray.forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'calendar-suggestion-item';
                
                let eventHTML = `<h4>${(event.suggested_title || `פגישה עם ${event.contact_person_or_company}`).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h4>`;
                eventHTML += `<p><strong>תיאור:</strong> ${(event.suggested_description || 'אין תיאור זמין').replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
                if(event.priority) eventHTML += `<p><strong>עדיפות:</strong> ${event.priority.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
                if(event.suggested_date) eventHTML += `<p><strong>תאריך מוצע:</strong> ${event.suggested_date.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
                if(event.suggested_time) eventHTML += `<p><strong>שעה מוצעת:</strong> ${event.suggested_time.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
                if(event.notes) eventHTML += `<p><strong>הערות:</strong> ${event.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;

                let startDateForLink, endDateForLink;
                if (event.suggested_date && event.suggested_time) {
                    try {
                        const [hours, minutes] = event.suggested_time.split(':').map(Number);
                        const d = new Date(event.suggested_date);
                        d.setHours(hours, minutes);
                        startDateForLink = d;
                        endDateForLink = new Date(d.getTime() + 60 * 60 * 1000); 
                    } catch (e) { /* Fallback handled by generateGoogleCalendarLink */ }
                }
                
                const gCalLink = generateGoogleCalendarLink(
                    event.suggested_title || `פגישה עם ${event.contact_person_or_company}`,
                    startDateForLink, 
                    endDateForLink,
                    event.suggested_description || '',
                    '' 
                );

                eventHTML += `<a href="${gCalLink}" target="_blank" class="calendar-button"><i class="fab fa-google"></i> הוסף ליומן Google</a>`;
                eventDiv.innerHTML = eventHTML;
                if(calendarSuggestionsContent) calendarSuggestionsContent.appendChild(eventDiv);
            });
        } else {
             if(calendarSuggestionsContent) calendarSuggestionsContent.innerHTML = '<p class="text-gray-500 italic">לא נמצאו הצעות תזמון ספציפיות מה-AI.</p>';
        }
    } catch (error) {
        console.error("Error in getCalendarSuggestions:", error);
        console.error("Problematic JSON string for calendar suggestions:", jsonStringForParsing);
        if(calendarSuggestionsContent) calendarSuggestionsContent.innerHTML = `<p class="text-red-500">אירעה שגיאה בקבלת הצעות תזמון: ${error.message}. בדוק את הקונסול.</p>`;
    }
}

async function reEvaluateAnalysis() {
    const newContext = additionalContextInput ? additionalContextInput.value.trim() : "";
    if (!newContext) {
        if(reevaluationStatus) {
            reevaluationStatus.textContent = "אנא הזן הקשר נוסף.";
            reevaluationStatus.className = "mt-3 text-sm text-yellow-600";
        }
        return;
    }

    if(reevaluationStatus) {
        reevaluationStatus.textContent = "מעדכן ניתוח...";
        reevaluationStatus.className = "mt-3 text-sm text-blue-600";
    }
    
    const summaryElement = document.querySelector('#section-summary .section-content');
    const aharonTasksElement = document.getElementById('aharon-tasks');
    const kalmanDevTasksElement = document.getElementById('kalman-dev-tasks');

    const currentReportState = {
        executiveSummary: summaryElement ? summaryElement.innerHTML : "אין סיכום קיים.",
        aharonTasks: aharonTasksElement ? Array.from(aharonTasksElement.querySelectorAll('li')).map(li => li.textContent.split('<button')[0].trim()) : [],
        kalmanDevTasks: kalmanDevTasksElement ? Array.from(kalmanDevTasksElement.querySelectorAll('li')).map(li => li.textContent.trim()) : []
    };
    
    openModal("🔄 עדכון ניתוח עם הקשר חדש");

    const prompt = `
        אתה AI המסייע בעדכון ניתוח שיחה קיים בהתבסס על הקשר חדש שסופק על ידי המשתמש.
        
        הניתוח המקורי (בקיצור) הוא:
        <סיכום_מקורי>
        ${currentReportState.executiveSummary.replace(/<[^>]*>/g, ' ').substring(0, 500)}... 
        </סיכום_מקורי>

        <משימות_אהרון_מקוריות>
        ${currentReportState.aharonTasks.join('\n- ')}
        </משימות_אהרון_מקוריות>

        <משימות_קלמן_ודוות_מקוריות>
        ${currentReportState.kalmanDevTasks.join('\n- ')}
        </משימות_קלמן_ודוות_מקוריות>

        המשתמש הוסיף את ההקשר החדש הבא:
        <הקשר_חדש>
        ${newContext}
        </הקשר_חדש>

        בהתבסס על כל המידע הזה (הניתוח המקורי וההקשר החדש), אנא ספק JSON מעודכן עבור סיכום המנהלים (executiveSummary) ורשימות המשימות (actionItems.forAharon, actionItems.forKalmanDev) בלבד, בהתאם למבנה ה-JSON המלא שצוין ב-"Advanced AI Call Transcription Analysis Prompt".
        החזר רק את האובייקט JSON המכיל את השדות "executiveSummary" ו-"actionItems" המעודכנים.
        לדוגמה:
        {
          "executiveSummary": { "callType": "...", "mainPurpose": "...", ... },
          "actionItems": {
            "forAharon": [ { "taskDescription": "...", ... } ],
            "forKalmanDev": [ { "taskDescription": "...", ... } ]
          }
        }
        ודא שה-JSON תקין לחלוטין, ללא שגיאות תחביר כמו פסיקים מיותרים.
    `;
    let jsonResponseForReval = "";
    try {
        jsonResponseForReval = await callGeminiAPI(prompt, true); 
        const updatedData = JSON.parse(jsonResponseForReval);

        if (updatedData.executiveSummary && summaryElement) {
            const es = updatedData.executiveSummary;
            let summaryHTML = `<p class="mb-2"><strong>סוג שיחה:</strong> ${es.callType || 'לא צוין'}</p>`;
            summaryHTML += `<p class="mb-2"><strong>מטרה עיקרית:</strong> ${es.mainPurpose || 'לא צוין'}</p>`;
            if (es.keyOutcomesAndDecisions && es.keyOutcomesAndDecisions.length > 0) {
                summaryHTML += `<p class="mb-1"><strong>החלטות ותוצאות מפתח:</strong></p><ul class="list-disc pr-5">${es.keyOutcomesAndDecisions.map(item => `<li>${item.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`).join('')}</ul>`;
            }
            if (es.criticalRoadblocks && es.criticalRoadblocks.length > 0) {
                summaryHTML += `<p class="mt-2 mb-1"><strong>חסמים/אתגרים קריטיים:</strong></p><ul class="list-disc pr-5">${es.criticalRoadblocks.map(item => `<li>${item.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`).join('')}</ul>`;
            }
            summaryHTML += `<p class="mt-2"><strong>סנטימנט כללי:</strong> ${es.overallSentiment || 'לא צוין'}</p>`;
            summaryElement.innerHTML = summaryHTML;
        }

        if (updatedData.actionItems) {
            if(aharonTasksElement) aharonTasksElement.innerHTML = createActionListItems(updatedData.actionItems.forAharon, true);
            if(kalmanDevTasksElement) kalmanDevTasksElement.innerHTML = createActionListItems(updatedData.actionItems.forKalmanDev, false);
        }

        if(reevaluationStatus) {
            reevaluationStatus.textContent = "הניתוח עודכן בהצלחה!";
            reevaluationStatus.className = "mt-3 text-sm text-green-600";
        }
        setTimeout(() => closeModal(), 1500);

    } catch (error) {
        console.error("Error re-evaluating analysis:", error);
        console.error("Problematic JSON string for re-evaluation:", jsonResponseForReval);
        if(geminiResponseContent) geminiResponseContent.textContent = '';
        if(geminiError) {
            geminiError.textContent = `אירעה שגיאה בעדכון הניתוח: ${error.message}. בדוק קונסול.`;
            geminiError.style.display = 'block';
        }
        if(reevaluationStatus) {
            reevaluationStatus.textContent = "שגיאה בעדכון הניתוח.";
            reevaluationStatus.className = "mt-3 text-sm text-red-600";
        }
    } finally {
        if(geminiLoadingIndicator) geminiLoadingIndicator.style.display = 'none';
    }
}

// --- UI Interactions (Sidebar, Collapsible sections) ---
function setupUIEventListeners() {
    const uiSidebar = document.getElementById('sidebar');
    const uiMenuButton = document.getElementById('menu-button');
    
    if (uiMenuButton && uiSidebar) {
        uiMenuButton.addEventListener('click', () => {
            uiSidebar.classList.toggle('hidden-sidebar');
        });
    }
    
    document.querySelectorAll('#report-navigation .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (window.innerWidth < 1024 && uiSidebar) { 
                uiSidebar.classList.add('hidden-sidebar');
            }
            document.querySelectorAll('#report-navigation .nav-link').forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    // Optional: Smooth scroll
                    // e.preventDefault(); 
                    // targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    document.querySelectorAll('h2[data-collapsible]').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.report-section');
            if (section) section.classList.toggle('collapsed');
        });
    });

    const uiNavLinks = document.querySelectorAll('#report-navigation a');
    const uiSections = document.querySelectorAll('.report-section');
    let uiScrollTimeout;

    window.addEventListener('scroll', () => {
        clearTimeout(uiScrollTimeout);
        uiScrollTimeout = setTimeout(() => { 
            let current = '';
            uiSections.forEach(section => {
                if (section) { 
                    const sectionTop = section.offsetTop;
                    const sectionHeight = section.offsetHeight;
                    if (pageYOffset >= sectionTop - (window.innerHeight / 3) && pageYOffset < sectionTop + sectionHeight - (window.innerHeight / 3)) {
                        current = section.getAttribute('id');
                    }
                }
            });

            uiNavLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') && link.getAttribute('href').substring(1) === current) {
                    link.classList.add('active');
                }
            });
            if (!current && uiNavLinks.length > 0 && uiSections.length > 0 && uiSections[0] && pageYOffset < uiSections[0].offsetTop) {
                 if(uiNavLinks[0]) uiNavLinks[0].classList.add('active'); 
            }
        }, 100); 
    });

    if (uiNavLinks.length > 0 && uiSections.length > 0) {
        let activeFoundOnLoad = false;
        uiSections.forEach(section => {
             if (section) { 
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                 if (pageYOffset >= sectionTop - 80 && pageYOffset < sectionTop + sectionHeight - 80) { 
                    const activeLink = document.querySelector(`#report-navigation a[href="#${section.id}"]`);
                    if(activeLink) {
                        activeLink.classList.add('active');
                        activeFoundOnLoad = true;
                    }
                }
            }
        });
        if (!activeFoundOnLoad && uiNavLinks[0] && uiSections[0] && pageYOffset < uiSections[0].offsetTop) { 
             if(uiNavLinks[0]) uiNavLinks[0].classList.add('active');
        }
    }
}
// CSV Data (Placeholder - will be populated by populateReportWithData)
const csvDataPoints = [
    ["קטגוריה", "פרט"]
];

// Event listener for closing modal with Escape key
window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
        if (modal && modal.style.display === 'flex') {
            closeModal();
        }
    }
});

// Close modal if clicked outside of modal-content
window.onclick = function(event) {
    if (modal && event.target == modal) { 
        closeModal();
    }
}
// Make sure this is the very last part of the script.
// No code, not even comments, should follow this line in this specific file.
