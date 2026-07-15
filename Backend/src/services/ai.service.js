const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


const geminiInterviewReportSchema = {
    type: "OBJECT",
    properties: {
        matchScore: {
            type: "INTEGER",
            description: "A score between 0 and 100 indicating how well the candidate's profile matches the job description."
        },
        technicalQuestions: {
            type: "ARRAY",
            description: "Exactly 10 technical questions related to the job and candidate profile.",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    topic: { type: "STRING", description: "The specific topic or concept being tested (e.g. Java Collections, SQL Joins)." },
                    difficulty: { type: "STRING", enum: ["Easy", "Medium", "Hard"] },
                    expectedPoints: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                        description: "List of key points, keywords, or concepts that should be included in the answer."
                    }
                },
                required: ["question", "topic", "difficulty", "expectedPoints"]
            }
        },
        behavioralQuestions: {
            type: "ARRAY",
            description: "Exactly 5 behavioral questions tailored for the target role.",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    competency: { type: "STRING", description: "The skill or behavioral trait tested (e.g. Problem Solving, Conflict Resolution)." },
                    answerGuidance: { type: "STRING", description: "Brief advice or framework (such as STAR) to structure the answer." }
                },
                required: ["question", "competency", "answerGuidance"]
            }
        },
        skillGaps: {
            type: "ARRAY",
            description: "List of missing skills or gap areas observed relative to the target role.",
            items: {
                type: "OBJECT",
                properties: {
                    skill: { type: "STRING" },
                    severity: { type: "STRING", enum: ["low", "medium", "high"] },
                    reason: { type: "STRING", description: "Why this skill gap is important and how it can be mitigated." }
                },
                required: ["skill", "severity", "reason"]
            }
        },
        roadmap: {
            type: "ARRAY",
            description: "A day-by-day 7-day preparation roadmap plan.",
            items: {
                type: "OBJECT",
                properties: {
                    day: { type: "INTEGER", description: "Day number from 1 to 7." },
                    focus: { type: "STRING", description: "Main theme/focus of this day." },
                    tasks: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                        description: "List of clean task action strings to complete."
                    }
                },
                required: ["day", "focus", "tasks"]
            }
        },
        title: {
            type: "STRING",
            description: "Job title of the role target."
        }
    },
    required: ["matchScore", "technicalQuestions", "behavioralQuestions", "skillGaps", "roadmap", "title"]
};

function normalizeLabeledArray(arr, keys) {
    if (!Array.isArray(arr) || arr.length === 0) {
        return []
    }

    const normalized = []
    const keySet = new Set(keys)
    let current = {}

    for (let i = 0; i < arr.length; i += 1) {
        const key = arr[i]
        const value = arr[i + 1]

        if (typeof key !== "string") {
            continue
        }

        const field = key.trim()
        if (!keySet.has(field)) {
            continue
        }

        if (field === keys[0] && Object.keys(current).length > 0) {
            normalized.push(current)
            current = {}
        }

        current[field] = value
        i += 1
    }

    if (Object.keys(current).length > 0) {
        normalized.push(current)
    }

    return normalized
}

function safeString(value) {
    if (typeof value === "string") {
        return value.trim()
    }
    if (value == null) {
        return ""
    }
    return String(value)
}

const safeParseJsonValue = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return fallback;

    let cleaned = value
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    try {
        let parsed = JSON.parse(cleaned);
        if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
        }
        return parsed;
    } catch (e) {
        try {
            const unescaped = cleaned.replace(/\\"/g, '"').replace(/^"/, "").replace(/"$/, "");
            let parsed = JSON.parse(unescaped);
            if (typeof parsed === "string") {
                parsed = JSON.parse(parsed);
            }
            return parsed;
        } catch (e2) {
            console.error("[Parser] Failed to parse JSON value:", cleaned.substring(0, 100));
            return fallback;
        }
    }
};

function normalizeInterviewReport(parsed) {
    if (!parsed) return {};

    const matchScore = Number(parsed.matchScore ?? parsed.match_score ?? parsed.score ?? 0) || 0;

    let rawTech = parsed.technicalQuestions ?? parsed.technical_questions ?? (parsed.questions && parsed.questions.technical) ?? [];
    rawTech = safeParseJsonValue(rawTech, []);
    let technicalQuestions = [];
    if (Array.isArray(rawTech)) {
        technicalQuestions = rawTech.map(item => {
            if (typeof item === "string") {
                try {
                    const cleanItem = item.trim().replace(/^"/, "").replace(/"$/, "").replace(/\\"/g, '"');
                    if (cleanItem.startsWith("{") && cleanItem.endsWith("}")) {
                        const parsedItem = JSON.parse(cleanItem);
                        return {
                            question: safeString(parsedItem.question || parsedItem.q || ""),
                            topic: safeString(parsedItem.topic || parsedItem.intention || "General"),
                            difficulty: safeString(parsedItem.difficulty || "Medium"),
                            expectedPoints: Array.isArray(parsedItem.expectedPoints) ? parsedItem.expectedPoints.map(safeString) : (parsedItem.answer ? [safeString(parsedItem.answer)] : [])
                        };
                    }
                } catch (e) {}
                return { question: item, topic: "General", difficulty: "Medium", expectedPoints: [] };
            }
            return {
                question: safeString(item.question || item.questionText || item.q || ""),
                topic: safeString(item.topic || item.intention || item.category || "General"),
                difficulty: safeString(item.difficulty || "Medium"),
                expectedPoints: Array.isArray(item.expectedPoints) ? item.expectedPoints.map(safeString) : (item.answer ? [safeString(item.answer)] : [])
            };
        }).filter(item => item.question.length > 0);
    }

    let rawBehavioral = parsed.behavioralQuestions ?? parsed.behavioral_questions ?? (parsed.questions && parsed.questions.behavioral) ?? [];
    rawBehavioral = safeParseJsonValue(rawBehavioral, []);
    let behavioralQuestions = [];
    if (Array.isArray(rawBehavioral)) {
        behavioralQuestions = rawBehavioral.map(item => {
            if (typeof item === "string") {
                try {
                    const cleanItem = item.trim().replace(/^"/, "").replace(/"$/, "").replace(/\\"/g, '"');
                    if (cleanItem.startsWith("{") && cleanItem.endsWith("}")) {
                        const parsedItem = JSON.parse(cleanItem);
                        return {
                            question: safeString(parsedItem.question || parsedItem.q || ""),
                            competency: safeString(parsedItem.competency || parsedItem.intention || "Behavioral"),
                            answerGuidance: safeString(parsedItem.answerGuidance || parsedItem.answer || "")
                        };
                    }
                } catch (e) {}
                return { question: item, competency: "Behavioral", answerGuidance: "" };
            }
            return {
                question: safeString(item.question || item.questionText || item.q || ""),
                competency: safeString(item.competency || item.intention || item.skill || item.category || "Behavioral"),
                answerGuidance: safeString(item.answerGuidance || item.guidance || item.tip || item.answer || "")
            };
        }).filter(item => item.question.length > 0);
    }

    let rawSkill = parsed.skillGaps ?? parsed.skill_gaps ?? parsed.skillsGap ?? [];
    rawSkill = safeParseJsonValue(rawSkill, []);
    let skillGaps = [];
    if (Array.isArray(rawSkill)) {
        skillGaps = rawSkill.map(item => {
            if (typeof item === "string") {
                try {
                    const cleanItem = item.trim().replace(/^"/, "").replace(/"$/, "").replace(/\\"/g, '"');
                    if (cleanItem.startsWith("{") && cleanItem.endsWith("}")) {
                        const parsedItem = JSON.parse(cleanItem);
                        return {
                            skill: safeString(parsedItem.skill || parsedItem.name || ""),
                            severity: safeString(parsedItem.severity || "medium").toLowerCase(),
                            reason: safeString(parsedItem.reason || parsedItem.explanation || "")
                        };
                    }
                } catch (e) {}
                
                if (item.includes('":"')) {
                    try {
                        const wrapped = JSON.parse(`{${item.replace(/\\"/g, '"')}}`);
                        return {
                            skill: safeString(wrapped.skill || ""),
                            severity: safeString(wrapped.severity || "medium").toLowerCase(),
                            reason: safeString(wrapped.reason || "")
                        };
                    } catch (e) {}
                }
                return { skill: item, severity: "medium", reason: "" };
            }
            return {
                skill: safeString(item.skill || item.name || ""),
                severity: safeString(item.severity || "medium").toLowerCase(),
                reason: safeString(item.reason || item.explanation || "")
            };
        }).filter(item => item.skill.length > 0);
    }

    let rawRoadmap = parsed.roadmap ?? parsed.roadMap ?? parsed.road_map ?? parsed.preparationPlan ?? parsed.preparation_plan ?? parsed.preparationRoadmap ?? [];
    rawRoadmap = safeParseJsonValue(rawRoadmap, []);
    let roadmap = [];
    if (Array.isArray(rawRoadmap)) {
        roadmap = rawRoadmap.map((item, idx) => {
            if (typeof item === "string") {
                try {
                    const cleanItem = item.trim().replace(/^"/, "").replace(/"$/, "").replace(/\\"/g, '"');
                    if (cleanItem.startsWith("{") && cleanItem.endsWith("}")) {
                        const parsedItem = JSON.parse(cleanItem);
                        return {
                            day: Number(parsedItem.day) || (idx + 1),
                            focus: safeString(parsedItem.focus || parsedItem.title || ""),
                            tasks: Array.isArray(parsedItem.tasks) ? parsedItem.tasks.map(safeString) : (parsedItem.tasks ? [safeString(parsedItem.tasks)] : [])
                        };
                    }
                } catch (e) {}
                
                if (item.includes('":"')) {
                    try {
                        const wrapped = JSON.parse(`{${item.replace(/\\"/g, '"')}}`);
                        return {
                            day: Number(wrapped.day) || (idx + 1),
                            focus: safeString(wrapped.focus || wrapped.title || ""),
                            tasks: Array.isArray(wrapped.tasks) ? wrapped.tasks.map(safeString) : (wrapped.tasks ? [safeString(wrapped.tasks)] : [])
                        };
                    } catch (e) {}
                }
                
                const dayMatch = item.match(/Day\s*(\d+)/i)
                const dayNum = dayMatch ? Number(dayMatch[1]) : (idx + 1)
                const cleanText = item.replace(/^Day\s*\d+\s*:\s*/i, "").trim()
                return {
                    day: dayNum,
                    focus: cleanText.substring(0, 50),
                    tasks: [cleanText]
                };
            }
            
            let rawTasks = item.tasks ?? item.activities ?? [];
            if (typeof rawTasks === "string") {
                rawTasks = safeParseJsonValue(rawTasks, [rawTasks]);
            }
            
            return {
                day: Number(item.day !== undefined ? item.day : item.d) || (idx + 1),
                focus: safeString(item.focus || item.title || ""),
                tasks: Array.isArray(rawTasks) ? rawTasks.map(safeString) : [safeString(rawTasks)]
            };
        }).filter(item => item.focus.length > 0);
    }

    const title = safeString(parsed.title ?? parsed.coaching_plan_title ?? parsed.coachingPlanTitle ?? "Coaching Plan");

    return {
        matchScore,
        technicalQuestions,
        behavioralQuestions,
        skillGaps,
        roadmap,
        title
    };
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {

    const prompt = `You are an expert interview coach assistant. Respond ONLY with valid JSON matching the requested schema.
    Do NOT include any explanatory text, markdown formatting, or code fences.
    Do NOT serialize nested arrays or objects as strings inside properties. Ensure all properties contain real JSON arrays or objects directly.

    Expected JSON Schema Structure Example:
    {
      "matchScore": 75,
      "skillGaps": [
        {
          "skill": "Spring Boot",
          "severity": "high",
          "reason": "Required in the job description but missing from the resume."
        }
      ],
      "technicalQuestions": [
        {
          "question": "Explain the difference between an interface and an abstract class in Java.",
          "topic": "Java OOP",
          "difficulty": "Medium",
          "expectedPoints": [
            "Multiple inheritance through interfaces",
            "State and constructors in abstract classes"
          ]
        }
      ],
      "behavioralQuestions": [
        {
          "question": "Tell me about a difficult bug you resolved.",
          "competency": "Problem Solving",
          "answerGuidance": "Use the STAR format."
        }
      ],
      "roadmap": [
        {
          "day": 1,
          "focus": "Core Java and OOP",
          "tasks": [
            "Revise inheritance, abstraction, polymorphism, and interfaces",
            "Practice five Java OOP questions"
          ]
        }
      ],
      "title": "Java Developer Strategy"
    }

    Resume: ${resume}
    Self Description: ${selfDescription}
    Job Description: ${jobDescription}

    Instructions:
    - Generate EXACTLY 10 technicalQuestions (focused on target job requirements).
    - Generate EXACTLY 5 behavioralQuestions.
    - Generate EXACTLY 7 days in the roadmap plan.
    - Generate all observed skillGaps (including concrete reasons).
    - Determine matchScore between 0 and 100.
    `

    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: geminiInterviewReportSchema,
                }
            })

            let rawText = response.text || response.outputText || JSON.stringify(response)
            console.log("AI raw response:", rawText)
            
            rawText = rawText.trim()
            if (rawText.startsWith("```")) {
                rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
            }
            rawText = rawText.trim()

            const parsed = JSON.parse(rawText)
            const normalized = normalizeInterviewReport(parsed)

            return normalized
        } catch (error) {
            lastError = error;
            if (error.status === 503 && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`Attempt ${attempt} failed with 503. Retrying in ${waitTime / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                throw error;
            }
        }
    }

    throw lastError;
}



async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    })
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    // Page utilization optimization loop
    const a4Height = 1122; // Height of A4 at 96 DPI
    let contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    let utilization = (contentHeight / a4Height) * 100;
    
    console.log(`[PDF Gen] Initial - A4 Height: ${a4Height}px, Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);

    let attempts = 0;
    const maxAttempts = 20;
    
    // Scale up if utilization is below 90%
    while (contentHeight < 1010 && attempts < maxAttempts) {
        attempts++;
        await page.evaluate(() => {
            const root = document.documentElement;
            const getVal = (name) => {
                const styleVal = getComputedStyle(root).getPropertyValue(name);
                return styleVal ? parseFloat(styleVal) : null;
            };
            
            const bodyFontSize = getVal('--body-font-size') || 9.5;
            const lineHeight = getVal('--line-height') || 1.35;
            const nameSize = getVal('--name-size') || 19;
            const headingSize = getVal('--heading-size') || 12;
            const sectionSpacing = getVal('--section-spacing') || 8;
            const entrySpacing = getVal('--entry-spacing') || 5;
            const bulletSpacing = getVal('--bullet-spacing') || 2;
            
            root.style.setProperty('--body-font-size', `${bodyFontSize + 0.1}px`);
            root.style.setProperty('--line-height', `${lineHeight + 0.02}`);
            root.style.setProperty('--name-size', `${nameSize + 0.2}px`);
            root.style.setProperty('--heading-size', `${headingSize + 0.15}px`);
            root.style.setProperty('--section-spacing', `${sectionSpacing + 0.5}px`);
            root.style.setProperty('--entry-spacing', `${entrySpacing + 0.4}px`);
            root.style.setProperty('--bullet-spacing', `${bulletSpacing + 0.2}px`);
        });
        
        contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        utilization = (contentHeight / a4Height) * 100;
        console.log(`[PDF Gen] Scale Up ${attempts} - Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);
    }

    // Scale down if utilization is over 98% (1100px) to prevent 2nd page spillover
    while (contentHeight > 1100 && attempts < maxAttempts) {
        attempts++;
        await page.evaluate(() => {
            const root = document.documentElement;
            const getVal = (name) => {
                const styleVal = getComputedStyle(root).getPropertyValue(name);
                return styleVal ? parseFloat(styleVal) : null;
            };
            
            const bodyFontSize = getVal('--body-font-size') || 9.5;
            const lineHeight = getVal('--line-height') || 1.35;
            const nameSize = getVal('--name-size') || 19;
            const headingSize = getVal('--heading-size') || 12;
            const sectionSpacing = getVal('--section-spacing') || 8;
            const entrySpacing = getVal('--entry-spacing') || 5;
            const bulletSpacing = getVal('--bullet-spacing') || 2;
            
            root.style.setProperty('--body-font-size', `${bodyFontSize - 0.05}px`);
            root.style.setProperty('--line-height', `${lineHeight - 0.01}`);
            root.style.setProperty('--name-size', `${nameSize - 0.1}px`);
            root.style.setProperty('--heading-size', `${headingSize - 0.1}px`);
            root.style.setProperty('--section-spacing', `${sectionSpacing - 0.25}px`);
            root.style.setProperty('--entry-spacing', `${entrySpacing - 0.2}px`);
            root.style.setProperty('--bullet-spacing', `${bulletSpacing - 0.1}px`);
        });
        
        contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        utilization = (contentHeight / a4Height) * 100;
        console.log(`[PDF Gen] Scale Down ${attempts} - Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);
    }

    console.log(`[PDF Gen] Final Page Utilization - A4 Height: ${a4Height}px, Content Height: ${contentHeight}px, Utilization: ${utilization.toFixed(1)}%`);

    const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {
            top: "10mm",
            bottom: "10mm",
            left: "10mm",
            right: "10mm"
        },
        printBackground: true
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumeHtml({ resume, selfDescription, jobDescription }) {
    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `You are an expert resume builder and ATS optimizer. Build a single-page ATS-friendly professional resume based on the following candidate profile:
    
    Candidate Profile:
    ${resume ? `Resume Content: ${resume}` : ""}
    ${selfDescription ? `Self Description: ${selfDescription}` : ""}

    Target Job Description:
    ${jobDescription}

    Instructions:
    Generate a JSON object with a single key "html", containing the complete HTML string of the resume.
    The resume must fit on EXACTLY ONE A4 page.
    Use the following fitting strategy to utilize vertical space efficiently:
    - Include a maximum of 3-4 most relevant projects and prioritize those matching the target Java Developer job description.
    - Write a factual and role-specific Career Objective / Professional Summary of exactly 3-4 lines. Do not overstate experience or repeat skills listed in the Skills section.
    - Keep 3-4 strong bullets for the most relevant experience entry, and 2-3 bullets for less relevant experience entries. Start all bullets with action verbs.
    - Keep 2-3 bullets per project.
    - Display all available achievements and certifications.
    - Strip any duplicate text or empty fields/sections.

    Exact Section Order to include (only display sections if data exists):
    1. Full Name (Prominently displayed at the top)
    2. Contact Information
    3. Career Objective / Professional Summary (3-4 lines tailored for the target role, avoiding first-person pronouns like "I", "me", "my", "we". Factual and clearly separating actual experience from target role interest).
    4. Education (Sorted newest first, i.e., highest degree first)
    5. Experience (Company, Role, Work Mode, Date, and bullet points)
    6. Projects (Title, description bullets, and a separate Tech line. Do not place a role or date unless available in source data.)
    7. Technical Skills and Soft Skills (Compact categorized lines)
    8. Achievements / Certifications (Simple factual bullets)

    Contact Information Line Rules:
    - Display all available contact fields in ONE clean, centered, and compact line below the name using this exact order and " | " as the separator:
      Location | Phone | Email | LinkedIn | GitHub | LeetCode | Portfolio
    - Show ONLY fields that exist in the profile and hide unavailable fields and unnecessary separators. Do not use icons, emojis, images, or logos.
    - Use clickable <a> tags for URLs with short, clean labels: "LinkedIn", "GitHub", "LeetCode", "Portfolio". Do not show full raw URLs.

    Target-Role Alignment:
    - The target role is Java Developer. Prioritize actual Java skills, Java projects, OOP experience, backend knowledge, REST APIs, databases, and problem-solving.
    - Include Java only when it exists in the source resume/profile.
    - Do NOT claim Spring Boot, Hibernate, microservices, or other skills unless present in the source data.

    Consistent Technology Names:
    - Normalize all tech names strictly to these: JavaScript, React.js, Node.js, Express.js, MongoDB, MySQL, REST APIs, NumPy, Pandas, NLP, GitHub, LinkedIn, HackerRank, LeetCode.

    Date Formatting Rules:
    - Use one consistent format for date ranges (e.g. "Nov 2023 – May 2025", "Jan 2020 – Feb 2021", "2019 – 2023"). Do not show project dates unless project dates exist in source data.

    Education Entry Row Rules:
    - Institution Name and Date must be on the same row, aligned left and right. Qualification and Date/Score titles must be bolded/strong.
    - Qualification and Score must be on the next row, aligned left and right.
    - Normalize ordinal labels: use "12th", "10th" (not "th 12" or "10 th").
    - Do not show empty or missing score fields.
    - Example structure:
      <div class="entry">
        <div class="row"><strong>IMS Engineering College, Ghaziabad</strong><span>2023–Present</span></div>
        <div class="row">B.Tech Computer Science & Engineering (AKTU)<span>CGPA: 8.5</span></div>
      </div>

    Experience & Project Entry Row Rules:
    - Experience format: Company | Role | Work Mode (aligned left, bold/strong) and Date (aligned right) on the first row.
    - Project format: Project Name | Role / Main Technologies (aligned left, bold/strong) on the first row.
    - Bullet points must start with action verbs and include verifiable metrics only. Avoid vague statements like "demonstrated proficiency."

    Skills Category Rules:
    - Use these exact compact category names:
      Programming:
      Backend:
      Frontend:
      Databases:
      Tools & Version Control:
      Soft Skills:
    - Put target-role-relevant skills first. Do not mix soft skills into technical categories.

    Achievements / Certifications Rules:
    - Factual bullet points with simple details. Correct issuer capitalization (e.g., HackerRank, LeetCode, EduSkills).

    Styling Rules (embed in a <style> block inside the HTML and define CSS variables on :root):
    - Page setup:
      @page {
        size: A4;
        margin: 10mm;
      }
      :root {
        --body-font-size: 9.5px;
        --line-height: 1.35;
        --name-size: 19px;
        --heading-size: 12px;
        --section-spacing: 8px;
        --entry-spacing: 5px;
        --bullet-spacing: 2px;
      }
      body {
        font-family: 'Times New Roman', Times, serif;
        font-size: var(--body-font-size);
        line-height: var(--line-height);
        color: #000;
        background-color: #fff;
        margin: 0;
        padding: 0;
      }
      a {
        color: #0000EE;
        text-decoration: underline;
      }
      .candidate-name {
        font-size: var(--name-size);
        font-weight: bold;
        text-align: center;
        margin: 0 0 5px 0;
      }
      .contact-info {
        font-size: var(--body-font-size);
        text-align: center;
        margin-bottom: 10px;
      }
      .section-title {
        font-size: var(--heading-size);
        font-weight: bold;
        text-transform: uppercase;
        border-bottom: 1px solid #000;
        margin: var(--section-spacing) 0 5px 0;
        padding-bottom: 2px;
      }
      .entry {
        margin-bottom: var(--entry-spacing);
      }
      .row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
      }
      strong, b {
        font-weight: bold;
    }
      ul {
        margin: 0;
        padding-left: 15px;
      }
      li {
        margin-bottom: var(--bullet-spacing);
      }
      .skills-section p {
        margin: 3px 0;
      }
    `

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })

    let rawText = response.text || ""
    rawText = rawText.trim()
    if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }
    rawText = rawText.trim()

    const jsonContent = JSON.parse(rawText)
    return jsonContent.html
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const htmlContent = await generateResumeHtml({ resume, selfDescription, jobDescription })
    return await generatePdfFromHtml(htmlContent)
}

module.exports = { generateInterviewReport, normalizeInterviewReport, generateResumePdf, generateResumeHtml, generatePdfFromHtml }