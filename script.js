// --- Global Variables & Initial Setup ---
let geminiApiKey = ""; 
// DOM elements will be assigned in DOMContentLoaded
let apiKeyStatusElement, processingStatus, transcriptionInput, modal, modalTitle, 
    geminiResponseContent, geminiLoadingIndicator, geminiError, 
    additionalContextInput, reevaluationStatus, calendarSuggestionsContent;

// Version control objects
const versionHistory = {
    summary: [],
    actionItems: []
};
const currentVersionIndex = {
    summary: -1,
    actionItems: -1
};

// Note: 'advancedAnalysisPrompt' is now expected to be defined globally 
// by including prompts.js BEFORE this script in index.html.


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
        if (processingStatus) { 
            processingStatus.textContent = "שגיאה קריטית: קובץ ההנחיות (prompts.js) לא נטען כראוי או שהמשתנה advancedAnalysisPrompt אינו מוגדר בו. בדוק את הקונסול.";
            processingStatus.className = "mt-3 text-sm text-red-500 font-bold";
        } else {
            alert("שגיאה קריטית בטעינת הנחיות AI. בדוק את הקונסול.");
        }
    }

    loadApiKey();
    setupUIEventListeners();
    // Initialize version UI for sections that support it
    updateVersionUI('summary');
    updateVersionUI('actionItems');
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

// --- Version Control Functions ---
function saveVersion(sectionKey, contentToSave = null) {
    let contentArea;
    if (sectionKey === 'summary') {
        contentArea = document.getElementById('summary-content-area');
    } else if (sectionKey === 'actionItems') {
        contentArea = document.getElementById('action-items-content-area');
    }

    if (contentArea) {
        const currentContent = contentToSave !== null ? contentToSave : contentArea.innerHTML;
        const history = versionHistory[sectionKey];
        
        if (!history || history.length === 0 || (history.length > 0 && history[history.length - 1].content !== currentContent)) {
            if (currentVersionIndex[sectionKey] < history.length - 1) {
                versionHistory[sectionKey] = history.slice(0, currentVersionIndex[sectionKey] + 1);
            }
            versionHistory[sectionKey].push({ content: currentContent, timestamp: new Date() });
            currentVersionIndex[sectionKey] = versionHistory[sectionKey].length - 1;
        }
        updateVersionUI(sectionKey);
        clearAIPendingState(sectionKey); 
        // console.log(`Version saved for ${sectionKey}. History length: ${versionHistory[sectionKey].length}, Current index: ${currentVersionIndex[sectionKey]}`);
    }
}

function loadVersion(sectionKey, direction) {
    const history = versionHistory[sectionKey];
    let newIndex = currentVersionIndex[sectionKey];

    if (direction === 'prev' && newIndex > 0) {
        newIndex--;
    } else if (direction === 'next' && newIndex < history.length - 1) {
        newIndex++;
    } else {
        return; 
    }

    let contentArea;
    if (sectionKey === 'summary') {
        contentArea = document.getElementById('summary-content-area');
    } else if (sectionKey === 'actionItems') {
        contentArea = document.getElementById('action-items-content-area');
    }

    if (contentArea && history[newIndex]) {
        contentArea.innerHTML = history[newIndex].content;
        currentVersionIndex[sectionKey] = newIndex;
        updateVersionUI(sectionKey);
        clearAIPendingState(sectionKey);
    }
}

function updateVersionUI(sectionKey) {
    const history = versionHistory[sectionKey];
    const currentIndex = currentVersionIndex[sectionKey];
    let versionInfoEl, prevButtonEl, nextButtonEl;

    if (sectionKey === 'summary') {
        versionInfoEl = document.getElementById('summaryVersionInfo');
        prevButtonEl = document.getElementById('prevSummaryVersion');
        nextButtonEl = document.getElementById('nextSummaryVersion');
    } else if (sectionKey === 'actionItems') {
        versionInfoEl = document.getElementById('actionItemsVersionInfo');
        prevButtonEl = document.getElementById('prevActionItemsVersion');
        nextButtonEl = document.getElementById('nextActionItemsVersion');
    }

    if (versionInfoEl) {
        if (history && history.length > 0) {
            versionInfoEl.textContent = `גרסה ${currentIndex + 1}/${history.length}`;
        } else {
            versionInfoEl.textContent = `גרסה -/-`;
        }
    }
    if (prevButtonEl) {
        prevButtonEl.disabled = !(history && currentIndex > 0);
    }
    if (nextButtonEl) {
        nextButtonEl.disabled = !(history && currentIndex < history.length - 1);
    }
}

function setAIPendingState(sectionKey, contentHTML) {
    let contentAreaId, approveButtonId;
    if (sectionKey === 'summary') {
        contentAreaId = 'summary-content-area';
        approveButtonId = 'approveSummaryAiChanges';
    } else if (sectionKey === 'actionItems') {
        contentAreaId = 'action-items-content-area'; 
        approveButtonId = 'approveActionItemsAiChanges';
    } else {
        return;
    }

    const contentArea = document.getElementById(contentAreaId);
    const approveButton = document.getElementById(approveButtonId);

    if (contentArea) {
        contentArea.innerHTML = contentHTML; 
        contentArea.classList.add('ai-updated-pending-save');
        contentArea.style.animation = 'none';
        contentArea.offsetHeight; 
        contentArea.style.animation = 'pulse-bg 2s infinite';
    }
    if (approveButton) {
        approveButton.classList.remove('hidden');
    }
}

function clearAIPendingState(sectionKey) {
    let contentAreaId, approveButtonId;
    if (sectionKey === 'summary') {
        contentAreaId = 'summary-content-area';
        approveButtonId = 'approveSummaryAiChanges';
    } else if (sectionKey === 'actionItems') {
        contentAreaId = 'action-items-content-area';
        approveButtonId = 'approveActionItemsAiChanges';
    } else {
        return;
    }

    const contentArea = document.getElementById(contentAreaId);
    const approveButton = document.getElementById(approveButtonId);

    if (contentArea) {
        contentArea.classList.remove('ai-updated-pending-save');
        contentArea.style.animation = ''; 
    }
    if (approveButton) {
        approveButton.classList.add('hidden');
    }
}

function approveAiChanges(sectionKey) {
    saveVersion(sectionKey); 
    const statusEl = sectionKey === 'summary' ? document.getElementById('summaryVersionInfo') : document.getElementById('actionItemsVersionInfo');
    if (statusEl) {
        updateVersionUI(sectionKey); 
        const currentVersionText = statusEl.textContent; 
        statusEl.textContent = `שינויי AI אושרו (${currentVersionText})`;
        setTimeout(() => { statusEl.textContent = currentVersionText; }, 2500);
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

    const allReportSections = document.querySelectorAll('.report-section[id^="section-"]');
    allReportSections.forEach(section => {
        if (section.id !== 'api-key-section' && section.id !== 'transcription-input-section' && section.id !== 'section-context-reeval') {
            section.classList.add('hidden');
            if (section.id === 'section-summary') clearAIPendingState('summary');
            if (section.id === 'section-action-items') clearAIPendingState('actionItems');
        }
    });


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
            
            versionHistory.summary = [];
            versionHistory.actionItems = [];
            currentVersionIndex.summary = -1;
            currentVersionIndex.actionItems = -1;
            
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

function hasContent(data) {
    if (data === null || typeof data === 'undefined') return false;
    if (typeof data === 'string' && data.trim() === '') return false;
    if (Array.isArray(data) && data.length === 0) return false;
    if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) return false;
    if (typeof data === 'object' && !Array.isArray(data)) {
        return Object.values(data).some(value => hasContent(value));
    }
    return true;
}


function populateReportWithData(data) {
    const showSectionIfPopulated = (sectionId, isPopulated) => {
        const sectionElement = document.getElementById(sectionId);
        if (sectionElement) {
            if (isPopulated) {
                sectionElement.classList.remove('hidden');
            } else {
                sectionElement.classList.add('hidden');
            }
        }
    };
    
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

    const createGeneralActionListItems = (itemsArray) => {
         if (!itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
             return '<li class="text-gray-500 italic">אין משימות זמינות.</li>';
         }
         return itemsArray.map(item => {
            const taskDescription = (item.taskDescription || 'משימה לא מוגדרת').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const assignedTo = (item.assignedTo || 'לא הוקצה').replace(/</g, "&lt;").replace(/>/g, "&gt;");
            let taskHTML = `<li><strong>${taskDescription}</strong> (לטיפול: ${assignedTo})`;
            if(item.impliedUrgency) taskHTML += `. דחיפות: ${item.impliedUrgency}.`;
            if(item.contextReason) taskHTML += ` (הקשר: ${item.contextReason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}).`;

            const taskDescLower = (item.taskDescription || "").toLowerCase();
            const assignedToLower = (item.assignedTo || "").toLowerCase();
            
            const assigneesToOfferEmail = ["אתי", "משה", "אהרון", "קלמן"]; 
            let isPersonAssigned = false;
            assigneesToOfferEmail.forEach(name => {
                if (assignedToLower.includes(name.toLowerCase())) {
                    isPersonAssigned = true;
                }
            });
            
            if ( (taskDescLower.includes('פנייה ל') || taskDescLower.includes('יצירת קשר עם') || taskDescLower.includes('תיאום עם') || isPersonAssigned) && 
                 !assignedToLower.includes('צוות') && !assignedToLower.includes('ללא הקצאה') && assignedTo.trim() !== "" ) {
                let taskContext = item.contextReason || item.taskDescription.split('עם ')[1] || item.taskDescription; 
                taskHTML += ` <button class="gemini-button ml-2" data-task-context="${taskContext.split('.')[0].trim().replace(/"/g, '&quot;')}" data-assigned-to="${assignedTo}" onclick="generateEmailDraft(this)"><i class="fas fa-wand-magic-sparkles"></i> הפק טיוטת מייל</button>`;
            }
            taskHTML += `</li>`;
            return taskHTML;
         }).join('');
    }

    // I. Executive Summary
    const summaryContentArea = document.getElementById('summary-content-area');
    let summaryPopulated = false;
    if (data.executiveSummary && summaryContentArea) {
        const es = data.executiveSummary;
        let summaryHTML = '';
        if (hasContent(es.callType)) summaryHTML += `<p class="mb-2"><strong>סוג שיחה:</strong> ${es.callType}</p>`;
        if (hasContent(es.mainPurpose)) summaryHTML += `<p class="mb-2"><strong>מטרה עיקרית:</strong> ${es.mainPurpose}</p>`;
        if (hasContent(es.keyOutcomesAndDecisions)) {
            summaryHTML += `<p class="mb-1"><strong>החלטות ותוצאות מפתח:</strong></p><ul class="list-disc pr-5">${createListItems(es.keyOutcomesAndDecisions)}</ul>`;
        }
        if (hasContent(es.criticalRoadblocks)) {
            summaryHTML += `<p class="mt-2 mb-1"><strong>חסמים/אתגרים קריטיים:</strong></p><ul class="list-disc pr-5">${createListItems(es.criticalRoadblocks)}</ul>`;
        }
        if (hasContent(es.overallSentiment)) summaryHTML += `<p class="mt-2"><strong>סנטימנט כללי:</strong> ${es.overallSentiment}</p>`;
        
        if (summaryHTML.trim() !== '') {
            summaryContentArea.innerHTML = summaryHTML;
            summaryPopulated = true;
        } else {
            summaryContentArea.innerHTML = '<p class="text-gray-500 italic">סיכום לא זמין.</p>';
        }
    } else if (summaryContentArea) {
         summaryContentArea.innerHTML = '<p class="text-gray-500 italic">סיכום לא זמין.</p>';
    }
    showSectionIfPopulated('section-summary', summaryPopulated);
    if (summaryPopulated) saveVersion('summary', summaryContentArea.innerHTML);


    // II. Action Items
    const allActionItemsUl = document.getElementById('all-action-items');
    const actionItemsContentArea = document.getElementById('action-items-content-area');
    let actionItemsPopulated = false;
    if (data.actionItems && Array.isArray(data.actionItems) && data.actionItems.length > 0 && allActionItemsUl) {
        allActionItemsUl.innerHTML = createGeneralActionListItems(data.actionItems);
        actionItemsPopulated = true;
    } else if (allActionItemsUl) {
        allActionItemsUl.innerHTML = '<li class="text-gray-500 italic">אין משימות ופעולות.</li>';
    }
    showSectionIfPopulated('section-action-items', actionItemsPopulated);
    if (actionItemsPopulated && actionItemsContentArea) { 
        saveVersion('actionItems', actionItemsContentArea.innerHTML);
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
        let sectionPopulated = false;
        if (sectionElement) {
            if (sectionData && typeof sectionData === 'object' && Object.keys(sectionData).length > 0 && hasContent(sectionData)) {
                let contentHTML = '';
                for (const key in sectionData) {
                    if (hasContent(sectionData[key])) { 
                        let titleKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        const translations = {
                            "productsServicesDiscussed": "מוצרים/שירותים שנדונו", "customerNeedsAddressed": "צרכי לקוח שטופלו",
                            "featureRequestsOrFeedback": "בקשות תכונה/משוב", "keyStrengthsUSPs": "חוזקות מרכזיות/USPs", 
                            "weaknessesImprovements": "חולשות/אזורים לשיפור",
                            "pricingMentionsOrProposals": "אזכורי תמחור/הצעות", "budgetConstraintsExpressed": "מגבלות תקציב שהובעו",
                            "valuePropositionDiscussed": "הצעת ערך שנדונה", "paymentTermsMentions": "אזכורי תנאי תשלום",
                            "customerProfileInsights": "תובנות פרופיל לקוח", "marketSegmentsMentioned": "פלחי שוק שאוזכרו",
                            "leadSource": "מקור הליד",
                            "keyTechnologiesPlatforms": "טכנולוגיות/פלטפורמות מפתח", "technicalIssuesReported": "בעיות טכניות שדווחו",
                            "solutionsProposedOrImplemented": "פתרונות שהוצעו/יושמו", "dataSecurityPrivacyMentions": "אזכורי אבטחת מידע/פרטיות",
                            "potentialOrExistingPartners": "שותפים פוטנציאליים/קיימים", "competitorMentions": "אזכורי מתחרים",
                            "externalResourcesNeeded": "משאבים חיצוניים נדרשים"
                        };
                        titleKey = translations[key] || titleKey;

                        if (Array.isArray(sectionData[key]) && sectionData[key].length > 0) {
                            contentHTML += `<h3>${titleKey}</h3><ul>${createListItems(sectionData[key])}</ul>`;
                            sectionPopulated = true;
                        } else if (typeof sectionData[key] === 'string' && sectionData[key].trim() !== '') {
                             contentHTML += `<p><strong>${titleKey}:</strong> ${sectionData[key].replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
                             sectionPopulated = true;
                        }
                    }
                }
                sectionElement.innerHTML = contentHTML || '<p class="text-gray-500 italic">אין נתונים זמינים לחלק זה.</p>';
            } else {
                sectionElement.innerHTML = '<p class="text-gray-500 italic">אין נתונים זמינים לחלק זה.</p>';
            }
            showSectionIfPopulated(sectionId.substring(1), sectionPopulated); 
        }
    }
    
    // Key Concerns
    const concernsListElement = document.getElementById('concerns-list');
    let concernsPopulated = false;
    if (data.keyConcerns && concernsListElement) {
        let concernsHTML = '';
        if (hasContent(data.keyConcerns.customerPainPoints)) {
            concernsHTML += '<h3>נקודות כאב של הלקוח:</h3><ul>' + createListItems(data.keyConcerns.customerPainPoints) + '</ul>';
            concernsPopulated = true;
        }
        if (hasContent(data.keyConcerns.objectionsRaised)) {
            concernsHTML += '<h3 class="mt-4">התנגדויות שהועלו:</h3><ul>' + createListItems(data.keyConcerns.objectionsRaised) + '</ul>';
            concernsPopulated = true;
        }
        if (hasContent(data.keyConcerns.risksOrChallengesDiscussed)) {
            concernsHTML += '<h3 class="mt-4">סיכונים/אתגרים שנדונו:</h3><ul>' + createListItems(data.keyConcerns.risksOrChallengesDiscussed) + '</ul>';
            concernsPopulated = true;
        }
        // Ensure the parent .section-content is updated, then re-add button if needed
        const concernsSectionContent = document.querySelector('#section-key-concerns .section-content');
        if (concernsSectionContent) {
            if (concernsPopulated) {
                concernsSectionContent.innerHTML = concernsHTML;
            } else {
                concernsSectionContent.innerHTML = '<ul id="concerns-list"><li class="text-gray-500 italic">אין חששות מרכזיים.</li></ul>';
            }
            // Always ensure the button is there if the section is shown (or if it's meant to be always there)
            if (!concernsSectionContent.querySelector('.gemini-button')) {
                const button = document.createElement('button');
                button.className = 'gemini-button mt-4';
                button.onclick = suggestSolutions;
                button.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> הצע פתרונות לאתגרים';
                concernsSectionContent.appendChild(button);
            }
        }
    }
    showSectionIfPopulated('section-key-concerns', concernsPopulated);


    // Participant Info
    const participantElement = document.querySelector('#section-participants-roles .section-content');
    let participantsPopulated = false;
    if (participantElement) {
        if (data.participantInfo && Array.isArray(data.participantInfo) && data.participantInfo.length > 0) {
            let participantHTML = '<ul>';
            data.participantInfo.forEach(p => {
                 participantHTML += `<li><strong>${(p.participantName || 'לא ידוע').replace(/</g, "&lt;").replace(/>/g, "&gt;")}:</strong> ${(p.participantRoleInCall || 'לא צוין תפקיד').replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`;
            });
            participantHTML += '</ul>';
            participantElement.innerHTML = participantHTML;
            participantsPopulated = true;
        } else {
            participantElement.innerHTML = '<p class="text-gray-500 italic">פרטי משתתפים לא זמינים.</p>';
        }
    }
    showSectionIfPopulated('section-participants-roles', participantsPopulated);


    // Important Quotes
    const quotesElement = document.querySelector('#section-quotes .section-content');
    let quotesPopulated = false;
    if (data.importantQuotes && data.importantQuotes.length > 0) {
       if(quotesElement) {
            quotesElement.innerHTML = `<ul>${createListItems(data.importantQuotes)}</ul>`;
            quotesPopulated = true;
       }
    } else {
        if(quotesElement) quotesElement.innerHTML = '<p class="text-gray-500 italic">אין ציטוטים חשובים.</p>';
    }
    showSectionIfPopulated('section-quotes', quotesPopulated);

    // People Mentioned Table
    const peopleTableBody = document.querySelector('#people-mentioned-table tbody');
    let peopleTablePopulated = false;
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
            peopleTablePopulated = true;
        } else {
            peopleTableBody.innerHTML = '<tr><td colspan="3" class="text-gray-500 italic text-center">לא הוזכרו אישים/גורמים ספציפיים.</td></tr>';
        }
    }
    showSectionIfPopulated('section-people-mentioned', peopleTablePopulated);


    // AI Notes
    const aiNotesElement = document.querySelector('#section-ai-notes .section-content');
    let aiNotesPopulated = false;
    if (data.aiNotes && data.aiNotes.length > 0) {
        if(aiNotesElement) {
            aiNotesElement.innerHTML = `<ul>${createListItems(data.aiNotes)}</ul>`;
            aiNotesPopulated = true;
        }
    } else {
        if(aiNotesElement) aiNotesElement.innerHTML = '<p class="text-gray-500 italic">אין הערות AI.</p>';
    }
    showSectionIfPopulated('section-ai-notes', aiNotesPopulated);
    
    showSectionIfPopulated('section-calendar-ai', true); 
    showSectionIfPopulated('section-context-reeval', true); 

    if(calendarSuggestionsContent) calendarSuggestionsContent.innerHTML = '<p class="text-gray-500 italic">הצעות ליומן יופיעו כאן...</p>';
    if(additionalContextInput) additionalContextInput.value = '';
    if(reevaluationStatus) reevaluationStatus.textContent = '';

    csvDataPoints.length = 1; 
    if(data.executiveSummary) csvDataPoints.push(["סיכום מנהלים", data.executiveSummary.mainPurpose || ""]);
    if(data.actionItems && Array.isArray(data.actionItems)) {
        data.actionItems.forEach(task => csvDataPoints.push([`משימה (${task.assignedTo || 'לא הוקצה'})`, task.taskDescription]));
    }
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
    const taskContext = buttonElement.dataset.taskContext || taskItem.textContent.split('.')[0].trim(); 
    const assignedTo = buttonElement.dataset.assignedTo || "הצוות"; 
    const callSummaryElement = document.querySelector('#section-summary .section-content p'); 
    const callSummary = callSummaryElement ? callSummaryElement.textContent : "לא סופק סיכום שיחה עדיין.";
    const productName = "המוצר/שירות שלנו"; 
    const userProvidedContext = additionalContextInput ? additionalContextInput.value.trim() : "";

    openModal(`✨ הפקת טיוטת מייל עבור: ${taskContext}`);

    let prompt = `
        אתה מתפקד כעוזר אישי.
        המשימה שלך היא לכתוב טיוטת מייל מקצועית וידידותית בעברית.
        המייל נשלח על ידי: "${assignedTo}".
        הנמען הוא איש קשר בנושא: "${taskContext}".
        מטרת המייל היא ליזום פגישה או המשך שיחה בנושא זה.
        
        הרקע הכללי לשיחה (מסיכום שיחת התכנון): "${callSummary}"
        שם המוצר/המיזם המרכזי הוא: "${productName}".
        
        במייל, אנא:
        1. התחל בפנייה מתאימה.
        2. ציין בקצרה את הנושא ("${taskContext}") ואת הרצון לקבוע פגישה/שיחה להרחבה.
        3. אם מתאים, רמוז לערך הפוטנציאלי של "${productName}" או שיתוף הפעולה עבור הנמען.
        4. הצע זמינות לפגישה או בקש מהנמען להציע זמן שנוח לו.
        5. שמור על טון חיובי ומקצועי.
        6. סיום בנימוס עם פרטי יצירת קשר של "${assignedTo}" (ניתן להשתמש בפרטים גנריים כמו "[שם] | [מספר טלפון] | [כתובת מייל]").
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
    const allActionItemsList = document.getElementById('all-action-items'); 
    let meetingTasksText = "משימות עיקריות לתיאום פגישות:\n";
    if (allActionItemsList && allActionItemsList.children.length > 0 && !allActionItemsList.children[0].classList.contains('italic')) {
        allActionItemsList.querySelectorAll('li').forEach(li => { 
            const taskText = li.textContent.toLowerCase();
            if (taskText.includes('פגישה') || taskText.includes('תיאום עם') || taskText.includes('ליצור קשר עם')) {
                 meetingTasksText += `- ${li.textContent.split('<button')[0].trim()}\n`;
            }
        });
        if (meetingTasksText === "משימות עיקריות לתיאום פגישות:\n") { 
            meetingTasksText = "לא זוהו משימות ספציפיות לתיאום פגישות בניתוח הנוכחי.\n";
        }
    } else {
         meetingTasksText = "לא זוהו משימות ספציפיות לתיאום פגישות בניתוח הנוכחי.\n";
    }

    const callSummaryElement = document.querySelector('#section-summary .section-content p');
    const callSummary = callSummaryElement ? callSummaryElement.textContent : "לא סופק סיכום שיחה עדיין.";
    const userProvidedContext = additionalContextInput ? additionalContextInput.value.trim() : "";

    if(calendarSuggestionsContent) calendarSuggestionsContent.innerHTML = `<div class="loading-indicator" style="display:block;"><i class="fas fa-spinner"></i><p>מעבד בקשה...</p></div>`;
    
    let prompt = `
        אתה AI המסייע בתכנון יומן. בהתבסס על סיכום השיחה הבא: "${callSummary}"
        ועל רשימת המשימות הבאה שזוהו מהשיחה וקשורות פוטנציאלית לתיאום פגישות:
        ${meetingTasksText}
    `;
    if (userProvidedContext) {
        prompt += `\n\nהקשר נוסף שסופק על ידי המשתמש ושחשוב להתייחס אליו בהצעות התזמון: "${userProvidedContext}"`;
    }
    prompt += `
        אנא ספק הצעות תזמון מפורטות בעברית. עבור כל פגישה מרכזית שניתן להסיק מהמשימות, ספק את הפרטים הבאים בפורמט JSON. כל אובייקט ב-JSON צריך לייצג פגישה ולהכיל את השדות: "contact_person_or_company", "suggested_title", "suggested_description", "priority" (למשל: "גבוהה", "בינונית", "רגילה"), "suggested_date" (בפו
