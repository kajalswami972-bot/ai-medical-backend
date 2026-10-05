import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Helper function with automatic model fallback
async function callGroqAI(userPrompt, base64Image = null) {
    const messages = [{
        role: "user",
        content: [{ type: "text", text: userPrompt }]
    }];

    if (base64Image) {
        messages[0].content.push({ 
            type: "image_url", 
            image_url: { url: `data:image/jpeg;base64,${base64Image}` } 
        });
    }

    // Try multiple models one by one automatically
    const modelsToTry = [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.2-11b-vision-preview",
        "llama3-70b-8192"
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
                    messages: messages
                }),
            });

            data = await response.json();
            
            // Agar model successfully chal gaya toh loop tod do
            if (!data.error) {
                console.log(`Successfully used model: ${currentModel}`);
                break;
            } else {
                lastError = data.error.message;
                console.log(`Model ${currentModel} failed, trying next...`);
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
    if (!base64Image) return res.status(400).json({ error: "No image" });

    const prompt = `Analyze this medical report in detail. Cover every single parameter, all abnormal values, and provide a full health summary. 
IMPORTANT: Do not summarize or truncate your response. Provide a complete, comprehensive report.`;
    const data = await callGroqAI(prompt, base64Image);
    
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