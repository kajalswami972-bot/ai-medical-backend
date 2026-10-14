import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ==========================================
// OPENROUTER AI HELPER
// Supports text and image input
// ==========================================

async function callOpenRouterAI(userPrompt, base64Image = null) {
    const apiKey =
        process.env.OPENROUTER_API_KEY ||
        process.env.GROQ_API_KEY;

    if (!apiKey) {
        return {
            error: {
                message: "API key missing. Check your .env file."
            }
        };
    }

    try {
        // Prepare message content
        const content = [
            {
                type: "text",
                text: userPrompt
            }
        ];

        // Attach image for medical report analysis
        if (base64Image) {
            let imageUrl = base64Image;

            // Handle raw Base64 and Data URL formats
            if (!imageUrl.startsWith("data:image/")) {
                imageUrl = `data:image/jpeg;base64,${imageUrl}`;
            }

            content.push({
                type: "image_url",
                image_url: {
                    url: imageUrl
                }
            });
        }

        // OpenRouter API request
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer":
                        "https://ai-medical-assistant.vercel.app",
                    "X-Title": "AI Medical Assistant"
                },

                body: JSON.stringify({
                    model: "openrouter/free",

                    messages: [
                        {
                            role: "user",
                            content: content
                        }
                    ],

                    temperature: 0.2
                })
            }
        );

        const data = await response.json();

        // Handle API errors
        if (!response.ok || data.error) {
            console.error(
                "OpenRouter API Error:",
                data.error || data
            );

            return {
                error: {
                    message:
                        data.error?.message ||
                        `API request failed with status ${response.status}`
                }
            };
        }

        const result =
            data.choices?.[0]?.message?.content;

        if (!result || typeof result !== "string") {
            return {
                error: {
                    message: "AI returned an empty response."
                }
            };
        }

        console.log("OpenRouter AI response received successfully.");

        return {
            choices: [
                {
                    message: {
                        content: result
                    }
                }
            ]
        };

    } catch (error) {
        console.error("AI Connection Error:", error.message);

        return {
            error: {
                message: "Unable to connect to the AI service."
            }
        };
    }
}


// ==========================================
// HELPER: CLEAN AI RESPONSE
// ==========================================

function cleanAIResponse(text) {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .trim();
}


// ==========================================
// ROUTE 1: MEDICAL REPORT ANALYSIS
// ==========================================

app.post("/api/analyze-report", async (req, res) => {
    try {
        const { base64Image } = req.body;

        // Validate uploaded image
        if (!base64Image || typeof base64Image !== "string") {
            return res.status(400).json({
                error: "Please upload a medical report image."
            });
        }

        const prompt = `
You are an AI medical report explanation assistant.

Carefully examine the uploaded medical report image.

IMPORTANT RULES:

1. Read the actual values from the uploaded image.
2. Never invent test names, results, units or reference ranges.
3. If any value is blurry or unreadable, say so clearly.
4. Prefer the reference ranges printed on the report.
5. Consider age and sex only if provided.
6. Do not diagnose a disease from one abnormal result.
7. Do not prescribe medicines or change existing prescriptions.
8. Explain findings in simple English.
9. Give recommendations related to the actual report findings.
10. If the report is not a medical report or cannot be read, explain that.

FORMAT YOUR RESPONSE USING THESE SECTIONS:

1. REPORT SUMMARY
Explain the type and purpose of the report.

2. TEST RESULTS
For each readable test, provide:
- Test name
- Observed value
- Unit
- Reference range
- Status: Normal, High, Low or Unclear
- Simple explanation

Use the report's own reference ranges whenever available.
Do not label a result abnormal without sufficient information.

3. ABNORMAL FINDINGS
Explain the potentially abnormal results and their possible significance.
Mention uncertainty where appropriate.

4. PERSONALIZED GENERAL RECOMMENDATIONS
Provide safe, practical recommendations based on the actual findings.
Avoid generic recommendations unrelated to the report.
Do not recommend medicines or supplements without clinical assessment.

5. WHEN TO SEE A DOCTOR
Explain whether routine follow-up or prompt medical assessment may be appropriate.
Do not delay urgent care when symptoms suggest an emergency.

6. LIMITATIONS
Mention unreadable values and explain that this analysis is not a final diagnosis.

Use headings and bullet points.
Do not use HTML tags.
`;


        const data = await callOpenRouterAI(
            prompt,
            base64Image
        );

        if (data.error) {
            return res.status(502).json({
                error: data.error.message
            });
        }

        const result = cleanAIResponse(
            data.choices[0].message.content
        );

        return res.json({
            success: true,
            result: result
        });

    } catch (error) {
        console.error("Report Analysis Error:", error);

        return res.status(500).json({
            error: "Unable to analyse the medical report. Please try again."
        });
    }
});


// ==========================================
// ROUTE 2: SYMPTOM CHECKER
// ==========================================

app.post("/api/check-symptoms", async (req, res) => {
    try {
        const { symptoms } = req.body;

        if (
            !symptoms ||
            typeof symptoms !== "string" ||
            !symptoms.trim()
        ) {
            return res.status(400).json({
                error: "Please enter your symptoms."
            });
        }

        const prompt = `
You are an AI health information assistant.

The user reports these symptoms:
"${symptoms}"

Please provide:

1. POSSIBLE EXPLANATIONS
List possible causes without claiming a definite diagnosis.

2. SELF-CARE
Suggest safe general measures where appropriate.

3. WHEN TO SEE A DOCTOR
Explain when medical evaluation is recommended.

4. EMERGENCY WARNING SIGNS
Mention relevant warning signs that require urgent medical attention.

RULES:
- Do not claim certainty.
- Do not prescribe medication or dosage.
- Do not recommend stopping prescribed medication.
- Ask for missing information if it materially affects the answer.
- Use simple English.
- Do not use HTML tags.
- Do not include <think> tags.
- Do not replace professional medical advice.
`;

        const data = await callOpenRouterAI(prompt);

        if (data.error) {
            return res.status(502).json({
                error: data.error.message
            });
        }

        const result = cleanAIResponse(
            data.choices[0].message.content
        );

        return res.json({
            success: true,
            result: result
        });

    } catch (error) {
        console.error("Symptom Checker Error:", error);

        return res.status(500).json({
            error: "Unable to analyse symptoms. Please try again."
        });
    }
});


// ==========================================
// ROUTE 3: HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "AI Medical Assistant backend is running."
    });
});


// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `AI Medical Assistant server running on port ${PORT}`
    );
});