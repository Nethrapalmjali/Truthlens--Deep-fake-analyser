# TruthLens - AI-Powered Deepfake Detection Platform

![TruthLens](https://img.shields.io/badge/AI-Deepfake%20Detection-emerald)
![PyTorch](https://img.shields.io/badge/PyTorch-EfficientNet-blue)
![React](https://img.shields.io/badge/Frontend-React-61dafb)

## 🎯 Overview

TruthLens is an advanced deepfake detection platform that uses state-of-the-art AI to help users identify manipulated media. Built for the hackathon, this full-stack application provides real-time analysis of images and videos with detailed confidence scores and risk assessments.

## ✨ Key Features

### 🔍 Detection Capabilities
- **Multi-Face Detection**: Analyze every face in your media with MTCNN detection technology
- **Confidence Scores**: Get detailed probability scores and risk assessments
- **Video Analysis**: Frame-by-frame temporal analysis with consistency metrics
- **Batch Processing**: Upload multiple files and analyze them all at once

### 📊 Analytics & Reporting
- **Interactive Dashboard**: Real-time analysis with visual charts
- **Risk Level Assessment**: LOW / MEDIUM / HIGH classification
- **Analysis History**: Track all past analyses with detailed statistics
- **Export Reports**: Download analysis results as JSON

### 🛡️ Privacy First
- Files deleted immediately after processing
- No data stored permanently
- JWT-based secure authentication

## 🏗️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **ML Model**: EfficientNet-B0 (PyTorch)
- **Face Detection**: MTCNN (facenet-pytorch)
- **Database**: MongoDB
- **Authentication**: JWT with bcrypt

### Frontend
- **Framework**: React
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Animations**: CSS transitions

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- MongoDB

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python server.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## 📸 Screenshots

The platform includes:
- Beautiful landing page with feature showcase
- Drag-and-drop file upload interface
- Real-time analysis with progress indicators
- Detailed results with pie charts and confidence scores
- Video frame analysis visualization
- Analysis history with statistics

## 🔬 How It Works

1. **Upload**: Drop your image or video file
2. **Detect**: AI locates and extracts all faces using MTCNN
3. **Analyze**: EfficientNet-B0 processes facial features
4. **Report**: Get detailed risk assessment with confidence scores

## 📝 Datasets

The model architecture is based on research-grade models trained on:
- FaceForensics++
- Celeb-DF
- DFDC (Deepfake Detection Challenge)

## ⚠️ Disclaimer

TruthLens provides AI-based predictions and should not be used as definitive proof. Accuracy may vary based on image quality, face visibility, and manipulation type. This tool is designed for research and educational purposes.

## 👥 Team

Built with ❤️ for the Hackathon 2026

## 📄 License

MIT License - See LICENSE for details
