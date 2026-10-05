import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Stable helper function using only active text models to avoid vision deprecation errors
async function callGroqAI(userPrompt) {
    const modelsToTry = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant"
    ];

    let data = null;
    let lastError = null;

    for (const currentModel of modelsToTry) {
        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [
                        {
                            role: "user",
                            content: userPrompt
                        }
                    ],
                    temperature: 0.7
                }),
            });

            data = await response.json();
            
            if (!data.error) {
                console.log(`Successfully used model: ${currentModel}`);
                break;
            } else {
                lastError = data.error.message;
            }
        } catch (err) {
            lastError = err.message;
        }
    }

    if (!data || data.error) {
        return { error: { message: lastError || "All models failed" } };
    }

    return data;
}

// Route 1: Prescription Analysis
app.post("/api/analyze-report", async (req, res) => {
    const { base64Image } = req.body;
    
    // Fallback text prompt since vision models are deprecated on free tier
    const prompt = `A user has uploaded a medical report image (Base64 data received). Provide a comprehensive guide on common medical report parameters, what abnormal ranges typically mean, and general health recommendations since direct image processing is currently restricted.`;
    
    const data = await callGroqAI(prompt);
    
    if (data.error) return res.status(500).json({ error: data.error.message });
    const result = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    res.json({ result });
});

// Route 2: Symptom Checker
app.post("/api/check-symptoms", async (req, res) => {
    const { symptoms } = req.body;
    if (!symptoms) return res.status(400).json({ error: "No symptoms" });

    const prompt = `Act as a medical assistant. Analyze: "${symptoms}". Provide advice and when to see a doctor. Constraint: No <think> tags.`;
    const data = await callGroqAI(prompt);
    
    if (data.error) return res.status(500).json({ error: data.error.message });
    const result = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    res.json({ result });
});

app.listen(5000, () => console.log("🚀 Server running on port 5000"));