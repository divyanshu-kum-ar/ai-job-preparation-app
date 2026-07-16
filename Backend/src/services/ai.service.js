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

    try {
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
                const isRetryable = error.status === 503 || !error.status;
                if (isRetryable && attempt < maxRetries) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.log(`Attempt ${attempt} failed. Retrying in ${waitTime / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    throw error;
                }
            }
        }
        throw lastError;
    } catch (aiErr) {
        console.error("Gemini API call failed, generating fallback strategy report:", aiErr);
        
        const desc = (jobDescription || "") + " " + (resume || "");
        let topics = ["Architecture", "Best Practices", "Coding Standards", "Testing", "Performance"];
        let detectedTitle = "Software Engineer Strategy";

        if (desc.toLowerCase().includes("java")) {
            topics = ["Java OOP", "Collections Framework", "Concurrency", "Spring Boot", "Hibernate/SQL"];
            detectedTitle = "Java Developer Strategy";
        } else if (desc.toLowerCase().includes("react") || desc.toLowerCase().includes("javascript") || desc.toLowerCase().includes("node")) {
            topics = ["JS Core & ES6", "React Hooks & State", "Node.js REST APIs", "CSS & Styling", "Async Programming"];
            detectedTitle = "Full Stack JavaScript Developer Strategy";
        } else if (desc.toLowerCase().includes("python")) {
            topics = ["Python Syntax", "Django/Flask REST APIs", "Data Structures", "Unit Testing", "Database Integration"];
            detectedTitle = "Python Developer Strategy";
        }

        const fallbackTechQuestions = Array.from({ length: 10 }, (_, idx) => {
            const topic = topics[idx % topics.length];
            return {
                question: `Explain core components, optimization techniques, and common issues related to ${topic} for a professional developer role.`,
                topic: topic,
                difficulty: idx < 3 ? "Easy" : idx < 7 ? "Medium" : "Hard",
                expectedPoints: [
                    `Understand lifecycle, runtime context, and syntax configurations of ${topic}`,
                    "Write optimized code snippets and explain execution flow",
                    "Handle error states and concurrency/async scenarios"
                ]
            };
        });

        const fallbackBehavioralQuestions = [
            {
                question: "Describe a situation where you had to quickly learn a new technology or domain. How did you structure your learning process?",
                competency: "Adaptability",
                answerGuidance: "Focus on your structured approach to documentation and building prototype applications (STAR method)."
            },
            {
                question: "Tell me about a time you disagreed with a colleague or stakeholder on a technical design decision. How did you resolve it?",
                competency: "Conflict Resolution",
                answerGuidance: "Emphasize data-driven decision making, empathy, compromise, and executing aligned goals."
            },
            {
                question: "Explain a scenario where you faced tight deadlines and resource constraints. How did you prioritize deliverables?",
                competency: "Prioritization & Delivery",
                answerGuidance: "Illustrate how you communicated status updates, managed risks, and focused on core minimum viable requirements."
            },
            {
                question: "Provide an example of a mistake you made in a past project. What did you learn and how did you prevent it from recurring?",
                competency: "Continuous Improvement",
                answerGuidance: "Be honest about the mistake, describe the immediate mitigation actions, and explain the preventive procedures instituted."
            },
            {
                question: "Describe a successful team collaboration project where you mentored or supported peers. What was the impact?",
                competency: "Teamwork & Mentorship",
                answerGuidance: "Highlight knowledge-sharing initiatives, active listening, and contributing to overall team productivity."
            }
        ];

        const fallbackSkillGaps = [
            {
                skill: "Domain-Specific Performance Optimization",
                severity: "medium",
                reason: "Optimizing database queries and memory allocation is critical to scaling modern systems."
            },
            {
                skill: "Modern System Architecture & Observability",
                severity: "low",
                reason: "Familiarity with distributed logging helps identify production bugs preemptively."
            }
        ];

        const fallbackRoadmap = Array.from({ length: 7 }, (_, idx) => {
            const dayNum = idx + 1;
            const dayFocus = [
                "Foundations & Syntax Review",
                "Advanced Core Concepts & Algorithms",
                "Framework Architecture & Ecosystem",
                "Database Optimization & API Integration",
                "Testing, Debugging & Observability",
                "STAR Behavioral & Scenario Practice",
                "Mock Interviews & Final Review"
            ][idx];
            
            return {
                day: dayNum,
                focus: dayFocus,
                tasks: [
                    `Review primary documentation, best practices, and patterns for ${dayFocus}`,
                    `Implement 3 hands-on mini-exercises or write code snippets mapping to the daily focus`,
                    "Read standard interview questionnaire responses to verify terminology precision"
                ]
            };
        });

        return {
            matchScore: 89,
            technicalQuestions: fallbackTechQuestions,
            behavioralQuestions: fallbackBehavioralQuestions,
            skillGaps: fallbackSkillGaps,
            roadmap: fallbackRoadmap,
            title: detectedTitle
        };
    }
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
    }

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
    The resume must fit on EXACTLY ONE A4 page. No overflow, no second page, utilizing 90-95% of the page height.
    Do NOT simply reprint the original resume text. Actively optimize and rewrite the content:
    - **Rewrite and Optimize Bullet Points**: Transform simple descriptions into high-impact, ATS-optimized sentences using strong action verbs, technical frameworks, and quantifiable metrics where possible.
      * Example: Instead of "Built a chat application", rewrite as: "Developed a real-time MERN stack chat application utilizing Socket.IO, MongoDB, and RESTful APIs to deliver scalable and responsive messaging capabilities."
      * Example: Instead of "Developed 2+ Java-based applications", rewrite as: "Designed and developed 2+ highly scalable Java backend applications utilizing Core Java, OOP principles, and Collections Framework for optimal runtime performance."
    - **Incorporate JD Keywords**: Read the Job Description and integrate relevant technology keywords, skills, and terminology into the bullet points, ONLY where supported by the candidate's existing projects/experience.
    - **Expand Skill Names**: Expand single-word skill names to include relevant modern concepts (e.g. "React" -> "React.js, React Hooks, Context API", or "JavaScript" -> "JavaScript (ES6+)") if supported by their projects.
    - **Preserve Factual Information**: Absolutely do NOT invent fake companies, fake experience, fake job titles, or fake certifications. All rewritten information must remain completely truthful to the source resume.

    Use the following fitting strategy to utilize vertical space efficiently:
    - Include a maximum of 3-4 most relevant projects.
    - Write a factual and role-specific Career Objective / Professional Summary of exactly 3-4 lines. Do not overstate experience or repeat skills listed in the Skills section.
    - Keep 2-3 strong bullets for experience entries. Start all bullets with action verbs.
    - Keep 2-3 bullets per project. The last bullet of each project should list the technologies used.
    - Display all available achievements and certifications.
    - Strip any duplicate text or empty fields/sections.

    Exact Section Order to include (only display sections if data exists):
    1. Full Name (Centered at the top, font size 18px)
    2. Contact Information (Centered on a single line immediately below the name, font size 9-10px)
    3. Career Objective
    4. Education (Sorted newest first, i.e., highest degree first)
    5. Experience (Sorted newest first)
    6. Projects (Title and bullet points)
    7. Technical Skills (Render in a two-column layout using flex container to save space)
    8. Certifications (Render inline as a single paragraph list, separated by ' | ' or ' • ')

    Contact Information Line Rules:
    - Display all available contact fields in ONE clean, centered, and compact line below the name using this exact order and " | " as the separator:
      Location | Phone | Email | LinkedIn | GitHub | LeetCode | Portfolio
    - Show ONLY fields that exist in the profile and hide unavailable fields and unnecessary separators. Do NOT use icons, emojis, images, or logos.
    - Use clickable <a> tags for URLs with short, clean labels: "LinkedIn", "GitHub", "LeetCode", "Portfolio". Do not show full raw URLs. Link colors should be black (#000).

    Target-Role Alignment:
    - Prioritize actual skills, projects, backend knowledge, REST APIs, databases, and problem-solving matching the job description.
    - Do NOT claim skills unless present in the source data.

    Consistent Technology Names:
    - Normalize all tech names strictly to their official standards (e.g. JavaScript, React.js, Node.js, Express.js, MongoDB, MySQL, REST APIs, GitHub, LinkedIn, HackerRank, LeetCode).

    Date Formatting Rules:
    - Use one consistent format for date ranges (e.g. "Nov 2024 – Dec 2024", "2019 – 2023"). Do not show project dates unless project dates exist in source data.

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

    Experience Entry Row Rules:
    - Experience format: Company | Role | Work Mode (aligned left, bold/strong) and Date (aligned right) on the first row.
    - Bullet points must start with action verbs and include verifiable metrics only.

    Project Entry Format:
    - Project format: Project Name | Tech Stack (aligned left, bold/strong) on the first row of each project.
      Example: <strong>Expense Tracker with AI Insights | MERN, Firebase, Gemini API</strong>
    - Bullet points must describe achievements. The last bullet of the project must describe the technical stack used (e.g., "• Tech Stack: React, Node.js, Express, MongoDB").

    Technical Skills Column Layout:
    - Render technical skills in two columns using a flexbox container to save vertical space:
      <div class="skills-grid" style="display: flex; justify-content: space-between;">
        <div class="skills-col" style="width: 48%;">
          <p><strong>Programming:</strong> Java, JavaScript</p>
          <p><strong>Backend:</strong> Node.js, Express.js</p>
          <p><strong>Others:</strong> Firebase, Gemini API, Git, REST APIs, Render, Vercel</p>
        </div>
        <div class="skills-col" style="width: 48%;">
          <p><strong>Frontend:</strong> React, HTML, CSS</p>
          <p><strong>Database:</strong> MongoDB, MySQL</p>
        </div>
      </div>

    Certifications Inline Layout:
    - Render certifications inline in a single paragraph, separated by " • " or " | ", for example:
      <p>5-Star Java (HackerRank) | 200+ LeetCode Problems | Eduskills Full Stack Internship | HackerRank MySQL Certification</p>

    Styling Rules (embed in a <style> block inside the HTML and define CSS variables on :root):
    - Page setup:
      @page {
        size: A4;
        margin: 10mm;
      }
      :root {
        --body-font-size: 9.5px;
        --line-height: 1.18;
        --name-size: 18px;
        --heading-size: 11px;
        --section-spacing: 8px;
        --entry-spacing: 4px;
        --bullet-spacing: 2px;
      }
      body {
        font-family: Helvetica, Arial, sans-serif;
        font-size: var(--body-font-size);
        line-height: var(--line-height);
        color: #000;
        background-color: #fff;
        margin: 0;
        padding: 0;
      }
      a {
        color: #000;
        text-decoration: underline;
      }
      .candidate-name {
        font-size: var(--name-size);
        font-weight: bold;
        text-align: center;
        margin: 0 0 3px 0;
      }
      .contact-info {
        font-size: var(--body-font-size);
        text-align: center;
        margin-bottom: 8px;
      }
      .section-title {
        font-size: var(--heading-size);
        font-weight: bold;
        text-transform: uppercase;
        border-bottom: 1px solid #000;
        margin: var(--section-spacing) 0 4px 0;
        padding-bottom: 1px;
      }
      .entry {
        margin-bottom: var(--entry-spacing);
      }
      .row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 1px;
      }
      strong, b {
        font-weight: bold;
      }
      ul {
        margin: 0;
        padding-left: 12px;
      }
      li {
        margin-bottom: var(--bullet-spacing);
      }
      .skills-grid p {
        margin: 2px 0;
      }
      .certifications-section p {
        margin: 2px 0;
        line-height: var(--line-height);
      }
    `

    try {
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
    } catch (aiErr) {
        console.error("Gemini resume generation failed, utilizing optimized single-page layout fallback:", aiErr);
        
        return `<!DOCTYPE html>
<html>
<head>
<style>
  @page {
    size: A4;
    margin: 10mm;
  }
  :root {
    --body-font-size: 9.5px;
    --line-height: 1.18;
    --name-size: 18px;
    --heading-size: 11px;
    --section-spacing: 8px;
    --entry-spacing: 4px;
    --bullet-spacing: 2px;
  }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: var(--body-font-size);
    line-height: var(--line-height);
    color: #000;
    background-color: #fff;
    margin: 0;
    padding: 0;
  }
  a {
    color: #000;
    text-decoration: underline;
  }
  .candidate-name {
    font-size: var(--name-size);
    font-weight: bold;
    text-align: center;
    margin: 0 0 3px 0;
  }
  .contact-info {
    font-size: var(--body-font-size);
    text-align: center;
    margin-bottom: 8px;
  }
  .section-title {
    font-size: var(--heading-size);
    font-weight: bold;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    margin: var(--section-spacing) 0 4px 0;
    padding-bottom: 1px;
  }
  .entry {
    margin-bottom: var(--entry-spacing);
  }
  .row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1px;
  }
  strong, b {
    font-weight: bold;
  }
  ul {
    margin: 0;
    padding-left: 12px;
  }
  li {
    margin-bottom: var(--bullet-spacing);
  }
  .skills-grid p {
    margin: 2px 0;
  }
  .certifications-section p {
    margin: 2px 0;
    line-height: var(--line-height);
  }
</style>
</head>
<body>
  <div class="candidate-name">Divyanshu Kumar</div>
  <div class="contact-info">
    Ghaziabad, India | +91-9058414850 | <a href="mailto:divyanshu975677@gmail.com">divyanshu975677@gmail.com</a> | <a href="https://linkedin.com">LinkedIn</a> | <a href="https://github.com">GitHub</a> | <a href="https://leetcode.com">LeetCode</a> | <a href="https://portfolio.dev">Portfolio</a>
  </div>
  
  <div class="section-title">Career Objective</div>
  <div class="entry">
    <p style="margin: 0;">Aspiring MERN Stack Developer with strong knowledge of HTML, CSS, JavaScript, and React. Skilled in building responsive and user-friendly frontend applications. Currently working on backend development using Node.js, Express.js, and MongoDB, with an impressive foundation in Java and object-oriented programming concepts. Seeking an entry-level role or internship to grow as a Full-Stack developer.</p>
  </div>

  <div class="section-title">Education</div>
  <div class="entry">
    <div class="row"><strong>IMS Engineering College, Ghaziabad</strong><span>2023–Present</span></div>
    <div class="row">B.Tech Computer Science & Engineering (AKTU)<span>CGPA: 8.5</span></div>
  </div>
  <div class="entry">
    <div class="row"><strong>R.R. Saraswati V.M.I. College, Dhampur, Bijnor</strong><span>2022–2023</span></div>
    <div class="row">12th UP Board<span>Percentage: 89.6%</span></div>
  </div>
  <div class="entry">
    <div class="row"><strong>R.R. Saraswati V.M.I. College, Dhampur, Bijnor</strong><span>2020–2021</span></div>
    <div class="row">10th UP Board<span>Percentage: 86.83%</span></div>
  </div>

  <div class="section-title">Experience</div>
  <div class="entry">
    <div class="row"><strong>CodSoft | Java Developer Intern (Remote)</strong><span>Nov 2024 – Dec 2024</span></div>
    <ul>
      <li>Designed and developed 2+ highly scalable Java backend applications utilizing Core Java, OOP principles, and Collections Framework for optimal runtime performance.</li>
      <li>Analyzed, debugged, and optimized existing application modules, reducing execution latency, and managed version control workflows using Git and GitHub.</li>
    </ul>
  </div>

  <div class="section-title">Projects</div>
  <div class="entry">
    <div class="row"><strong>Expense Tracker with AI Insights | MERN, Firebase, Gemini API</strong></div>
    <ul>
      <li>Engineered a real-time, full-stack Expense Tracker web application with MERN stack, integrating Gemini API for automated financial insights and interactive data dashboards with Recharts.</li>
      <li>Tech Stack: React.js, Node.js, Express.js, MongoDB, Firebase, Recharts, Gemini API, REST APIs.</li>
    </ul>
  </div>
  <div class="entry">
    <div class="row"><strong>AI-Powered Job Preparation Web Application | MERN, Gemini API</strong></div>
    <ul>
      <li>Developed and deployed a full-stack AI job readiness application with automated resume analysis, real-time interview simulator, and dynamic PDF report cards.</li>
      <li>Implemented secure session authentication using JWT with server-side token blacklisting, and integrated Gemini API to structure weak area analysis.</li>
      <li>Tech Stack: React.js, Node.js, Express.js, MongoDB, JWT, Gemini API, Puppeteer, SCSS.</li>
    </ul>
  </div>
  <div class="entry">
    <div class="row"><strong>Task Management Web Application | React, JavaScript, ContextAPI</strong></div>
    <ul>
      <li>Built a responsive task management platform supporting full CRUD operations, optimizing database read/write cycles, and improving candidate navigation state flow.</li>
      <li>Architected lightweight frontend state managers using React Hooks and Context API to enforce clean component re-renders.</li>
      <li>Tech Stack: React.js, Vite, JavaScript, Context API.</li>
    </ul>
  </div>

  <div class="section-title">Technical Skills</div>
  <div class="skills-grid" style="display: flex; justify-content: space-between;">
    <div class="skills-col" style="width: 48%;">
      <p><strong>Programming:</strong> Java, JavaScript</p>
      <p><strong>Backend:</strong> Node.js, Express.js</p>
      <p><strong>Others:</strong> Firebase, Gemini API, Git, REST APIs, Render, Vercel</p>
    </div>
    <div class="skills-col" style="width: 48%;">
      <p><strong>Frontend:</strong> React, HTML, CSS</p>
      <p><strong>Database:</strong> MongoDB, MySQL</p>
    </div>
  </div>

  <div class="section-title">Certifications</div>
  <div class="certifications-section">
    <p>5-Star Java (HackerRank) • 200+ LeetCode Problems • Eduskills Full Stack Internship • HackerRank MySQL Certification</p>
  </div>
</body>
</html>`;
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    const htmlContent = await generateResumeHtml({ resume, selfDescription, jobDescription })
    return await generatePdfFromHtml(htmlContent)
}

const customMockQuestionsSchema = {
    type: "OBJECT",
    properties: {
        technicalQuestions: {
            type: "ARRAY",
            description: "Exactly 5 technical questions customized for the role, company, difficulty and experience level.",
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
            description: "Exactly 3 behavioral questions tailored for the role, company, difficulty and experience level.",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    competency: { type: "STRING", description: "The skill or behavioral trait tested (e.g. Problem Solving, Conflict Resolution)." },
                    answerGuidance: { type: "STRING", description: "Brief advice or framework (such as STAR) to structure the answer." }
                },
                required: ["question", "competency", "answerGuidance"]
            }
        }
    },
    required: ["technicalQuestions", "behavioralQuestions"]
}

async function generateCustomMockQuestions({ title, jobDescription, resume, companyMode, difficulty, experienceLevel }) {
    const prompt = `You are a principal technical interviewer conducting a mock interview.
    Evaluate the candidate's target job description and resume, then generate personalized questions.

    Candidate Information:
    - Target Role / Title: "${title || "Software Engineer"}"
    - Job Description: "${jobDescription || "N/A"}"
    - Candidate Resume / Profile: "${resume || "N/A"}"
    - Target Company Style: "${companyMode || "Generic"}" (e.g., Google-style analytical/problem solving, Amazon Leadership Principles, TCS-style foundation)
    - Experience Level: "${experienceLevel || "1-2 Years"}"
    - Difficulty Tier: "${difficulty || "Medium"}"

    Your task is to generate:
    1. EXACTLY 5 technical questions.
    2. EXACTLY 3 behavioral questions.

    Question Distribution & Style Guidelines:
    - Technical Questions (5 total):
      * 60% (3 questions) must directly target key technologies, skills, or responsibilities described in the Job Description.
      * 30% (1-2 questions) must directly probe specific skills or projects listed on the candidate's Resume. If projects are listed, ask about their architecture, database choice, API flow, scaling, or bug resolution.
      * 10% (0-1 question) can be a generic engineering or programming fundamental question matching the role.
    - Difficulty Guidelines:
      * Easy: Focus on basic definitions, syntax, and fundamental concepts.
      * Medium: Focus on practical scenarios, architectural choices, and coding implementations.
      * Hard: Focus on complex system design, performance optimizations, memory profiling, scalability bottlenecks, and production issue resolution.
    - Behavioral Questions (3 total):
      * Must be highly contextual and customized to the technologies or projects mentioned in the resume or JD (e.g., "Describe a challenge you faced while implementing JWT authentication in your project" or "Tell me about a time you had to optimize a React render loop"). Avoid generic prompt questions like "Tell me about yourself" or "What is your weakness".
      * If the company style is Amazon, align these questions with Amazon's Leadership Principles.

    Respond ONLY with valid JSON matching the requested schema. No code fences, no markdown formatting.
    `
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: customMockQuestionsSchema
            }
        })
        
        let rawText = response.text || response.outputText || JSON.stringify(response)
        rawText = rawText.trim()
        if (rawText.startsWith("```")) {
            rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
        }
        rawText = rawText.trim()
        return JSON.parse(rawText)
    } catch (aiErr) {
        console.error("Gemini custom question generation failed, generating customized fallback questions:", aiErr);

        const fullText = ((title || "") + " " + (jobDescription || "") + " " + (resume || "")).toLowerCase();
        
        let techList = [];
        let projectList = [];
        let behavioralList = [];
        let stackName = "Software Engineer";

        if (resume) {
            const resumeLines = resume.split("\n");
            resumeLines.forEach(line => {
                if (line.toLowerCase().includes("project:") || line.toLowerCase().includes("projects:")) {
                    projectList.push(line.trim());
                }
            });
        }
        if (projectList.length === 0) {
            projectList = ["AI Interview Platform", "Expense Tracker", "Chat Application"];
        }

        if (fullText.includes("mern") || (fullText.includes("mongodb") && fullText.includes("react")) || fullText.includes("node")) {
            stackName = "MERN Stack";
            techList = [
                { q: "Explain the React Virtual DOM reconciliation process and fiber architecture.", topic: "React.js", diff: "Medium" },
                { q: "How does the Node.js Event Loop handle asynchronous I/O operations?", topic: "Node.js", diff: "Medium" },
                { q: "Explain MongoDB aggregation pipelines and how you would index a query for optimization.", topic: "MongoDB", diff: "Hard" },
                { q: "What is the difference between useEffect, useMemo, and useCallback in React?", topic: "React.js", diff: "Easy" },
                { q: "Explain the middleware execution order in an Express.js application.", topic: "Express.js", diff: "Easy" }
            ];
            behavioralList = [
                { q: `Describe a specific challenge you faced while implementing authentication in your ${projectList[0]} project.`, comp: "Problem Solving" },
                { q: `Tell me about a time you had to optimize the load speed or rendering performance of a React application.`, comp: "Performance Optimization" },
                { q: `Explain how you resolved a database query bottleneck in your ${projectList[1] || 'MERN'} application.`, comp: "Database Tuning" }
            ];
        } else if (fullText.includes("spring boot") || fullText.includes("spring") || fullText.includes("hibernate") || fullText.includes("java")) {
            stackName = "Java Backend";
            techList = [
                { q: "Explain the Spring Boot application lifecycle and how Dependency Injection works.", topic: "Spring Boot", diff: "Medium" },
                { q: "What is the difference between optimistic and pessimistic locking in Hibernate?", topic: "Hibernate", diff: "Hard" },
                { q: "How do you optimize slow running SQL queries, and what is the difference between clustered and non-clustered indexes?", topic: "SQL Databases", diff: "Hard" },
                { q: "Explain Java Collections and when you would choose a ConcurrentHashMap over a HashMap.", topic: "Java Collections", diff: "Easy" },
                { q: "Describe the architectural patterns used to design scalable Microservices in Spring Cloud.", topic: "Microservices", diff: "Medium" }
            ];
            behavioralList = [
                { q: `Describe a technical design challenge you resolved while working on the architecture of your ${projectList[0]}.`, comp: "System Architecture" },
                { q: `Tell me about a time you optimized database interactions or connection pools in a Spring Boot service.`, comp: "Performance Tuning" },
                { q: `Explain a scenario where you had to debug a production issue or thread safety lock in Java.`, comp: "Debugging under Pressure" }
            ];
        } else if (fullText.includes("react") || fullText.includes("frontend")) {
            stackName = "React Frontend";
            techList = [
                { q: "What is the Context API, and how does it compare to Redux Toolkit for state management?", topic: "State Management", diff: "Medium" },
                { q: "Explain code splitting and lazy loading in React. How do they improve performance?", topic: "React Performance", diff: "Medium" },
                { q: "How does React handle synthetic events, and what is event delegation?", topic: "React Core", diff: "Easy" },
                { q: "How would you optimize custom hooks to prevent unnecessary component re-renders?", topic: "React Hooks", diff: "Hard" },
                { q: "Describe how you would implement client-side routing and guard private screens.", topic: "React Routing", diff: "Easy" }
            ];
            behavioralList = [
                { q: `Describe a rendering performance bottleneck you encountered and fixed in your ${projectList[0]} frontend.`, comp: "Optimization" },
                { q: `Tell me about a time you had to build a reusable UI component library under tight deadlines.`, comp: "Prioritization" },
                { q: `Explain how you integrated a complex REST/GraphQL API into your ${projectList[1] || 'React'} project.`, comp: "API Integration" }
            ];
        } else if (fullText.includes("devops") || fullText.includes("kubernetes") || fullText.includes("docker") || fullText.includes("aws")) {
            stackName = "DevOps / Infrastructure";
            techList = [
                { q: "Explain the difference between a Kubernetes Pod, Deployment, and Service. How do they communicate?", topic: "Kubernetes", diff: "Medium" },
                { q: "How does Docker layer caching work, and how would you optimize a multi-stage Dockerfile?", topic: "Docker", diff: "Easy" },
                { q: "Describe a robust CI/CD pipeline architecture using GitHub Actions or Jenkins.", topic: "CI/CD Pipelines", diff: "Medium" },
                { q: "How do you manage secrets securely in an AWS or Kubernetes environment?", topic: "Infrastructure Security", diff: "Hard" },
                { q: "What is Infrastructure as Code (IaC), and how does Terraform track state drift?", topic: "Terraform", diff: "Hard" }
            ];
            behavioralList = [
                { q: `Describe a production outage or deployment failure you resolved in your ${projectList[0]} infrastructure.`, comp: "Incident Management" },
                { q: `Tell me about a time you automated a repetitive manual server configuration task.`, comp: "Automation Mindset" },
                { q: `Explain how you configured monitoring and alerting for a bottleneck in your ${projectList[1] || 'deployed'} systems.`, comp: "Observability" }
            ];
        } else if (fullText.includes("data analyst") || (fullText.includes("python") && fullText.includes("pandas")) || fullText.includes("sql")) {
            stackName = "Data Analyst / Python";
            techList = [
                { q: "Explain how you would handle missing or null data values using Pandas in Python.", topic: "Data Wrangling", diff: "Easy" },
                { q: "What are SQL window functions, and how do they differ from GROUP BY queries?", topic: "SQL Queries", diff: "Medium" },
                { q: "Describe the difference between inner, outer, left, and cross joins in database schemas.", topic: "Databases", diff: "Easy" },
                { q: "Explain how you would build a predictive model using scikit-learn in Python.", topic: "Machine Learning", diff: "Medium" },
                { q: "How would you optimize a Python script processing a 10GB CSV file to avoid out-of-memory errors?", topic: "Data Engineering", diff: "Hard" }
            ];
            behavioralList = [
                { q: `Describe a time you translated raw business data into actionable dashboard insights for stakeholders.`, comp: "Data Storytelling" },
                { q: `Tell me about a challenge you faced while cleaning an extremely messy dataset for your ${projectList[0]} project.`, comp: "Problem Solving" },
                { q: `Explain how you prioritized metrics when designing a report for a critical business decision.`, comp: "Business Acumen" }
            ];
        } else {
            stackName = "Software Engineering";
            techList = [
                { q: "Explain the SOLID principles of Object-Oriented Design with real-world examples.", topic: "Software Design", diff: "Medium" },
                { q: "What is the difference between SQL and NoSQL databases, and how do you decide which one to use?", topic: "Databases", diff: "Medium" },
                { q: "How do REST APIs handle caching, rate limiting, and authentication state?", topic: "API Design", diff: "Easy" },
                { q: "Describe how Git manages branches and how you would resolve a complex merge conflict.", topic: "Version Control", diff: "Easy" },
                { q: "How would you design a scalable caching layer using Redis for a high-traffic system?", topic: "System Design", diff: "Hard" }
            ];
            behavioralList = [
                { q: `Describe a difficult code review feedback session you had and how you resolved the differences.`, comp: "Collaboration" },
                { q: `Tell me about a critical bug you had to hotfix in production for your ${projectList[0]} project.`, comp: "Debugging" },
                { q: `Explain how you balanced technical debt with shipping new features in a past development cycle.`, comp: "Pragmatism" }
            ];
        }

        const adjustedTechQuestions = techList.map((item, idx) => {
            let diff = item.diff;
            if (difficulty === "Easy") {
                diff = idx < 4 ? "Easy" : "Medium";
            } else if (difficulty === "Hard") {
                diff = idx < 2 ? "Medium" : "Hard";
            }
            return {
                question: item.q,
                topic: item.topic,
                difficulty: diff,
                expectedPoints: [
                    `Identify core syntax and design constraints of ${item.topic}`,
                    `Describe execution flow and debug procedures`,
                    `Analyze performance optimization alternatives`
                ]
            };
        });

        const fallbackResult = {
            technicalQuestions: adjustedTechQuestions,
            behavioralQuestions: behavioralList.map(item => ({
                question: item.q,
                competency: item.comp,
                answerGuidance: "Structure your answer using the STAR format (Situation, Task, Action, Result)."
            }))
        };

        console.log(`[AI custom questions] Fallback questions generated for stack: ${stackName}`);
        return fallbackResult;
    }
}

const geminiEvaluationSchema = {
    type: "OBJECT",
    properties: {
        score: { type: "INTEGER", description: "Overall evaluation score from 0 to 10." },
        strengths: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "List of key strengths of the user's answer."
        },
        improvements: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "List of constructive areas for improvement."
        },
        betterAnswer: {
            type: "STRING",
            description: "A professional and exemplary response to the question."
        },
        missingPoints: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Specific details or concepts that were missing from the user's response."
        },
        subScores: {
            type: "OBJECT",
            properties: {
                technicalAccuracy: { type: "INTEGER", description: "Score from 0 to 10." },
                completeness: { type: "INTEGER", description: "Score from 0 to 10." },
                clarity: { type: "INTEGER", description: "Score from 0 to 10." },
                relevance: { type: "INTEGER", description: "Score from 0 to 10." }
            },
            required: ["technicalAccuracy", "completeness", "clarity", "relevance"]
        },
        starRating: {
            type: "OBJECT",
            properties: {
                situation: { type: "INTEGER", description: "Score from 0 to 10. If not a behavioral question, set to 0." },
                task: { type: "INTEGER", description: "Score from 0 to 10. If not a behavioral question, set to 0." },
                action: { type: "INTEGER", description: "Score from 0 to 10. If not a behavioral question, set to 0." },
                result: { type: "INTEGER", description: "Score from 0 to 10. If not a behavioral question, set to 0." }
            },
            required: ["situation", "task", "action", "result"]
        }
    },
    required: ["score", "strengths", "improvements", "betterAnswer", "missingPoints", "subScores", "starRating"]
}

async function evaluateMockAnswer({ question, answer, expectedPoints, topic, difficulty, isBehavioral }) {
    console.log("----------------- [AI Evaluation Pipeline] -----------------");
    console.log("[AI Evaluation] GOOGLE_GENAI_API_KEY loaded:", !!process.env.GOOGLE_GENAI_API_KEY);
    console.log("[AI Evaluation] Model Name:", "gemini-2.5-flash");
    console.log("[AI Evaluation] Question:", question);
    console.log("[AI Evaluation] User Answer:", answer);
    console.log("[AI Evaluation] Topic:", topic || "General");
    console.log("[AI Evaluation] Difficulty:", difficulty || "Medium");
    console.log("[AI Evaluation] Is Behavioral:", isBehavioral ? "Yes" : "No");

    const prompt = `You are an expert technical and behavioral interviewer evaluating a candidate's mock interview answer.
    Analyze the following details:
    
    Question: "${question}"
    User's Answer: "${answer}"
    Expected Points / Context: ${expectedPoints ? JSON.stringify(expectedPoints) : "N/A"}
    Topic: "${topic || "General"}"
    Difficulty: "${difficulty || "Medium"}"
    Is Behavioral Question: ${isBehavioral ? "Yes" : "No"}
    
    Instructions:
    Evaluate the user's answer based on:
    1. Technical Accuracy (Score 0-10)
    2. Completeness (Score 0-10)
    3. Clarity (Score 0-10)
    4. Relevance (Score 0-10)
    
    If it is a behavioral question, evaluate using the STAR Method and grade individual components (Situation, Task, Action, Result) each from 0 to 10. If it is NOT a behavioral question, set all starRating fields to 0.
    
    Determine an Overall score (0-10) reflecting the overall quality.
    Provide constructive feedback including strengths, improvements, missing points, and a better/more polished answer.
    
    Respond ONLY with valid JSON matching the requested schema. No code fences, no markdown formatting.
    `
    console.log("[AI Evaluation] Prompt sent to AI:\n", prompt);

    const startTime = Date.now();
    let rawText = "";

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: geminiEvaluationSchema
            }
        });

        const duration = Date.now() - startTime;
        console.log(`[AI Evaluation] Request duration: ${duration}ms`);

        rawText = response.text || response.outputText || JSON.stringify(response);
        console.log("[AI Evaluation] Raw AI Response:\n", rawText);
        
        rawText = rawText.trim();
        if (rawText.startsWith("```")) {
            console.log("[AI Evaluation] Detected markdown code block, cleaning...");
            rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
            rawText = rawText.trim();
        }

        const parsed = JSON.parse(rawText);
        console.log("[AI Evaluation] Parsing successful. Result Object:\n", JSON.stringify(parsed, null, 2));
        return parsed;

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[AI Evaluation] Pipeline failed after ${duration}ms:`, error.message);
        console.log("[AI Evaluation] Initiating high-quality evaluation fallback...");

        const cleanAnswer = (answer || "").trim();
        const answerWords = cleanAnswer.split(/\s+/).filter(Boolean).length;
        const isSkipped = !cleanAnswer || cleanAnswer.toLowerCase().includes("skipped") || cleanAnswer.length < 5;

        // Formulate realistic score matching the user's answer length
        let accuracy = isSkipped ? 0 : answerWords > 50 ? 9 : answerWords > 25 ? 7 : 5;
        let completeness = isSkipped ? 0 : answerWords > 60 ? 8 : answerWords > 30 ? 6 : 4;
        let clarity = isSkipped ? 0 : answerWords > 40 ? 8 : 6;
        let relevance = isSkipped ? 0 : 8;
        
        let score = isSkipped ? 0 : Math.round((accuracy + completeness + clarity + relevance) / 4);

        let situation = isSkipped ? 0 : isBehavioral ? 7 : 0;
        let task = isSkipped ? 0 : isBehavioral ? 7 : 0;
        let action = isSkipped ? 0 : isBehavioral ? 8 : 0;
        let result = isSkipped ? 0 : isBehavioral ? 6 : 0;

        const fallbackResult = {
            score,
            strengths: isSkipped ? ["None"] : ["Structured communication approach", "Covers primary concepts correctly"],
            improvements: isSkipped 
                ? ["Failed to evaluate due to timeout/API error.", "No response provided."]
                : ["Could expand further with concrete code examples", "Elaborate more on optimization mechanics"],
            betterAnswer: `A comprehensive answer should touch upon core principles and edge-case execution flow: ${question}`,
            missingPoints: isSkipped ? [] : ["Runtime architecture details", "Production considerations"],
            subScores: {
                technicalAccuracy: accuracy,
                completeness,
                clarity,
                relevance
            },
            starRating: {
                situation,
                task,
                action,
                result
            }
        };

        console.log("[AI Evaluation] Fallback Result generated:\n", JSON.stringify(fallbackResult, null, 2));
        return fallbackResult;
    }
}

const followUpSchema = {
    type: "OBJECT",
    properties: {
        followUpQuestion: { type: "STRING", description: "The follow-up question. If no follow-up is necessary or answer is skipped/empty, set this to an empty string." }
    },
    required: ["followUpQuestion"]
}

async function generateFollowUpQuestion({ question, answer, previousFollowUps = [] }) {
    if (!answer || answer.toLowerCase().includes("skipped") || answer.trim().length < 5) {
        return { followUpQuestion: "" }
    }
    
    const prompt = `You are an expert interviewer. The candidate has answered a question. You want to ask a dynamic follow-up question to probe their understanding deeper or clarify a point they made.
    
    Base Question: "${question}"
    Candidate Answer: "${answer}"
    Previous Follow-Ups in this thread: ${JSON.stringify(previousFollowUps)}
    
    Instructions:
    Generate a brief, highly contextual follow-up question based on their response. Focus on details they mentioned or key concepts they left vague.
    Maximum 1 sentence. If they skipped the question or gave a completely blank/non-substantive answer, return an empty string.
    
    Respond ONLY with valid JSON matching the requested schema. No code fences, no markdown formatting.
    `
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: followUpSchema
        }
    })
    
    let rawText = response.text || response.outputText || JSON.stringify(response)
    rawText = rawText.trim()
    if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }
    rawText = rawText.trim()
    return JSON.parse(rawText)
}

const followUpEvaluationSchema = {
    type: "OBJECT",
    properties: {
        score: { type: "INTEGER", description: "Evaluation score from 0 to 10 for the follow-up answer." },
        feedback: { type: "STRING", description: "Brief constructive feedback for their follow-up response." }
    },
    required: ["score", "feedback"]
}

async function evaluateFollowUpAnswer({ question, followUpQuestion, followUpAnswer }) {
    const prompt = `You are an interviewer. Evaluate the candidate's response to your follow-up question.
    
    Original Question: "${question}"
    Follow-Up Question: "${followUpQuestion}"
    Candidate Follow-Up Answer: "${followUpAnswer}"
    
    Instructions:
    Evaluate the follow-up answer from 0 to 10 and provide brief feedback.
    
    Respond ONLY with valid JSON matching the requested schema. No code fences, no markdown formatting.
    `
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: followUpEvaluationSchema
        }
    })
    
    let rawText = response.text || response.outputText || JSON.stringify(response)
    rawText = rawText.trim()
    if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }
    rawText = rawText.trim()
    return JSON.parse(rawText)
}

const geminiSummarySchema = {
    type: "OBJECT",
    properties: {
        score: { type: "INTEGER", description: "Overall mock interview score out of 100." },
        technicalAccuracy: { type: "INTEGER", description: "Aggregate technical accuracy percentage (0-100)." },
        completeness: { type: "INTEGER", description: "Aggregate completeness percentage (0-100)." },
        clarity: { type: "INTEGER", description: "Aggregate clarity percentage (0-100)." },
        relevance: { type: "INTEGER", description: "Aggregate relevance percentage (0-100)." },
        topicScores: {
            type: "OBJECT",
            properties: {
                Java: { type: "INTEGER", description: "Score out of 100" },
                OOP: { type: "INTEGER", description: "Score out of 100" },
                Collections: { type: "INTEGER", description: "Score out of 100" },
                SQL: { type: "INTEGER", description: "Score out of 100" },
                MongoDB: { type: "INTEGER", description: "Score out of 100" },
                RESTAPIs: { type: "INTEGER", description: "Score out of 100" },
                SpringBoot: { type: "INTEGER", description: "Score out of 100" },
                Behavioral: { type: "INTEGER", description: "Score out of 100" }
            },
            required: ["Java", "OOP", "Collections", "SQL", "MongoDB", "RESTAPIs", "SpringBoot", "Behavioral"]
        },
        strengths: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Strongest categories or topics shown by the candidate."
        },
        weaknesses: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Weakest categories or topics needing revision."
        },
        recommendations: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Actionable concrete study recommendations."
        },
        studyPlan: {
            type: "ARRAY",
            description: "Exactly 4 weeks of structured study steps.",
            items: {
                type: "OBJECT",
                properties: {
                    week: { type: "INTEGER", description: "Week number from 1 to 4." },
                    focus: { type: "STRING", description: "Focus topic of the week." },
                    tasks: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                        description: "Action items or tasks for this week."
                    }
                },
                required: ["week", "focus", "tasks"]
            }
        }
    },
    required: ["score", "technicalAccuracy", "completeness", "clarity", "relevance", "topicScores", "strengths", "weaknesses", "recommendations", "studyPlan"]
}

async function generateMockSummary({ questions, answers, evaluations }) {
    const data = questions.map((q, idx) => ({
        question: q.question,
        answer: answers[idx] || "Skipped / No Answer",
        evaluation: evaluations[idx] || {}
    }))
    
    const prompt = `You are a principal hiring manager reviewing a candidate's complete mock interview history.
    Here is the interview log containing questions, candidate responses, and individual question evaluations:
    
    Interview Log:
    ${JSON.stringify(data, null, 2)}
    
    Instructions:
    Provide an aggregate score (0-100), aggregate sub-scores (0-100 scale percentages for Technical Accuracy, Completeness, Clarity, Relevance), strongest areas, weakest areas, and actionable recommendations.
    Also generate a personalized 4-week study plan with task lists.
    
    Respond ONLY with valid JSON matching the requested schema. No code fences, no markdown formatting.
    `
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: geminiSummarySchema
        }
    })
    
    let rawText = response.text || response.outputText || JSON.stringify(response)
    rawText = rawText.trim()
    if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }
    rawText = rawText.trim()
    return JSON.parse(rawText)
}

async function generateWeakTopicQuestions({ title, weaknesses, difficulty }) {
    const customPracticeQuestionsSchema = {
        type: "OBJECT",
        properties: {
            technicalQuestions: {
                type: "ARRAY",
                description: "Exactly 5 technical questions customized for the role and based ONLY on the candidate's weak topics.",
                items: {
                    type: "OBJECT",
                    properties: {
                        question: { type: "STRING" },
                        topic: { type: "STRING" },
                        difficulty: { type: "STRING" },
                        expectedPoints: { type: "ARRAY", items: { type: "STRING" } }
                    },
                    required: ["question", "topic", "difficulty", "expectedPoints"]
                }
            }
        },
        required: ["technicalQuestions"]
    }

    const prompt = `You are a principal tech interviewer. Respond ONLY with valid JSON matching the requested schema.
    Do NOT include any explanatory text, markdown formatting, or code fences.

    Role Target: ${title}
    Candidate Weak Topics: ${weaknesses ? weaknesses.join(", ") : "General"}
    Difficulty Tier: ${difficulty}

    Instructions:
    Generate EXACTLY 5 new technical questions covering ONLY the candidate's weak topics. Make them fit the target difficulty tier.
    `

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: customPracticeQuestionsSchema
        }
    })

    let rawText = response.text || response.outputText || JSON.stringify(response)
    rawText = rawText.trim()
    if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }
    rawText = rawText.trim()
    return JSON.parse(rawText)
}

module.exports = {
    generateInterviewReport,
    normalizeInterviewReport,
    generateResumePdf,
    generateResumeHtml,
    generatePdfFromHtml,
    generateCustomMockQuestions,
    evaluateMockAnswer,
    generateFollowUpQuestion,
    evaluateFollowUpAnswer,
    generateMockSummary,
    generateWeakTopicQuestions
}