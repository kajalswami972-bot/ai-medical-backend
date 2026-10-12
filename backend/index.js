import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Helper function using OpenRouter API
async function callOpenRouterAI(userPrompt) {
    // OpenRouter active & reliable models
    const modelsToTry = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-chat:free",
        "apodex/apodex-1.1-mini:free",
        "inception/mercury-decide:free"
    ];

    let data = null;
    let lastError = null;

    for (const currentModel of modelsToTry) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ai-medical-assistant.vercel.app",
                    "X-Title": "AI Medical Assistant"
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
                console.log(`Successfully used OpenRouter model: ${currentModel}`);
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
    
    const prompt = `A user has uploaded a medical report image. Provide a comprehensive guide on common medical report parameters, abnormal ranges, and general health recommendations. Constraint: Do not use HTML tags like <br>.`;
    
    const data = await callOpenRouterAI(prompt);
    
    if (data.error) return res.status(500).json({ error: data.error.message });
    
    // Clean <think> tags and <br> tags
    const result = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .trim();
        
    res.json({ result });
});

// Route 2: Symptom Checker
app.post("/api/check-symptoms", async (req, res) => {
    const { symptoms } = req.body;
    if (!symptoms) return res.status(400).json({ error: "No symptoms" });

    const prompt = `Act as a medical assistant. Analyze: "${symptoms}". Provide advice and when to see a doctor. Constraint: Do not use HTML tags like <br> or <think> tags. Use clean text formatting.`;
    
    const data = await callOpenRouterAI(prompt);
    
    if (data.error) return res.status(500).json({ error: data.error.message });
    
    // Clean <think> tags and <br> tags
    const result = data.choices[0].message.content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .trim();
        
    res.json({ result });
});

app.listen(5000, () => console.log("🚀 Server running on port 5000 with OpenRouter"));