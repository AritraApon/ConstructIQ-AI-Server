import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Groq AI
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI as string,{
  dbName:'ConstructIQ',
})
  .then(() => console.log('🚀 MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Mongoose Schema & Model
const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  area: { type: Number, required: true },
  buildingType: { type: String, required: true },
  location: { type: String, required: true },
  aiEstimate: { type: String, required: true },
  userId: { type: String, required: true },
}, { timestamps: true });

const Project = mongoose.model('Project', ProjectSchema);

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('ConstructIQ AI Server is running via Groq!');
});

/**
 * FEATURE A: AI Cost & Material Generator + Save Project
 */
app.post('/api/projects/add', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, area, buildingType, location, userId } = req.body;

    if (!title || !area || !buildingType || !location || !userId) {
      res.status(400).json({ success: false, error: 'All fields are required including userId' });
      return;
    }

    const prompt = `You are an expert civil engineer and cost estimator. 
    Create a highly detailed, professional structural material and cost estimation for a ${area} sqft ${buildingType} building located in ${location}. 
    Provide estimated breakdown quantities for: Cement (bags), Steel (tons), Sand (cft), Bricks (pcs), and Total Estimated Budget in BDT.
    Format the response using clean Markdown headers (###) and bullet points. Do not include introductory chit-chat, start directly with the report.`;

    // Call Groq API
const chatCompletion = await groq.chat.completions.create({
  messages: [{ role: 'user', content: prompt }],
  model: 'llama-3.3-70b-versatile', // এখানেও আপডেট করো
});

    const generatedText = chatCompletion.choices[0]?.message?.content || 'Failed to generate estimate due to an AI error.';

    // Save to MongoDB
    const newProject = new Project({
      title,
      area,
      buildingType,
      location,
      aiEstimate: generatedText,
      userId
    });

    await newProject.save();

    res.status(201).json({
      success: true,
      message: 'Project created and AI estimate generated successfully!',
      data: newProject
    });

  } catch (error) {
    console.error('Add Project Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * GET ALL PROJECTS (Explore Page)
 */
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const { search, buildingType } = req.query;
    let query: any = {};

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    if (buildingType) {
      query.buildingType = buildingType;
    }

    const projects = await Project.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

/**
 * GET SINGLE PROJECT DETAILS
 */
app.get('/api/projects/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch project details' });
  }
});

/**
 * DELETE A PROJECT
 */
app.delete('/api/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Project.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

/**
 * FEATURE C: AI Smart Construction Assistant / Chatbot
 */
app.post('/api/ai/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const prompt = `You are "ConstructIQ AI Assistant", a smart civil engineering companion. 
    Answer the user's question accurately regarding construction guidelines, building codes, material estimation, or cost optimization.
    User Question: "${message}"`;

  const chatCompletion = await groq.chat.completions.create({
  messages: [{ role: 'user', content: prompt }],
  model: 'llama-3.3-70b-versatile', // এখানেও আপডেট করো
});

    res.status(200).json({ success: true, reply: chatCompletion.choices[0]?.message?.content });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ success: false, error: 'AI failed to respond' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`📡 Server running on http://localhost:${PORT}`);
});

