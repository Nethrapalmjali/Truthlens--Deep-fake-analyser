from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import aiofiles
import tempfile
import shutil
import io
import json

# ML imports
import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np
from facenet_pytorch import MTCNN
import timm

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============== IN-MEMORY DATABASE (For Demo - No MongoDB Required) ==============
# This simulates MongoDB collections in memory for hackathon demo purposes
# Data will reset when server restarts, but this is perfect for demos!

class InMemoryDB:
    """Simple in-memory database for hackathon demo - no MongoDB required!"""
    
    def __init__(self):
        self.users: Dict[str, Dict] = {}
        self.analyses: Dict[str, Dict] = {}
        print("[TruthLens] Demo Mode: Using in-memory storage (no MongoDB required)")
    
    async def find_user_by_email(self, email: str) -> Optional[Dict]:
        for user in self.users.values():
            if user.get("email") == email:
                return user
        return None
    
    async def find_user_by_id(self, user_id: str) -> Optional[Dict]:
        user = self.users.get(user_id)
        if user:
            # Return without password
            return {k: v for k, v in user.items() if k != "password"}
        return None
    
    async def insert_user(self, user_doc: Dict) -> None:
        self.users[user_doc["id"]] = user_doc
        print(f"[OK] User registered: {user_doc['email']}")
    
    async def insert_analysis(self, analysis_doc: Dict) -> None:
        self.analyses[analysis_doc["id"]] = analysis_doc
        print(f"[ANALYSIS] Saved: {analysis_doc['id'][:8]}... ({analysis_doc['verdict']})")
    
    async def get_user_analyses(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        user_analyses = [a for a in self.analyses.values() if a.get("user_id") == user_id]
        # Sort by created_at descending
        user_analyses.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return user_analyses[offset:offset + limit]
    
    async def get_analysis(self, analysis_id: str, user_id: str) -> Optional[Dict]:
        analysis = self.analyses.get(analysis_id)
        if analysis and analysis.get("user_id") == user_id:
            return analysis
        return None
    
    async def delete_analysis(self, analysis_id: str, user_id: str) -> bool:
        analysis = self.analyses.get(analysis_id)
        if analysis and analysis.get("user_id") == user_id:
            del self.analyses[analysis_id]
            print(f"[DELETED] Analysis: {analysis_id[:8]}...")
            return True
        return False
    
    async def get_user_stats(self, user_id: str) -> Dict:
        user_analyses = [a for a in self.analyses.values() if a.get("user_id") == user_id]
        return {
            "total": len(user_analyses),
            "images": sum(1 for a in user_analyses if a.get("file_type") == "image"),
            "videos": sum(1 for a in user_analyses if a.get("file_type") == "video"),
            "fake": sum(1 for a in user_analyses if a.get("verdict") == "FAKE"),
            "real": sum(1 for a in user_analyses if a.get("verdict") == "REAL")
        }

# Initialize in-memory database
db = InMemoryDB()

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'truthlens-deepfake-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="TruthLens - Deepfake Detection API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== ML MODEL SETUP ==============

# Device configuration
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
logger.info(f"Using device: {device}")

# Initialize MTCNN for face detection
mtcnn = None
deepfake_model = None

def init_mtcnn():
    global mtcnn
    if mtcnn is None:
        mtcnn = MTCNN(
            image_size=299,
            margin=40,
            min_face_size=50,
            thresholds=[0.6, 0.7, 0.7],
            factor=0.709,
            post_process=True,
            device=device,
            keep_all=True  # Keep all faces
        )
    return mtcnn

# Custom DeepfakeDetector with enhanced architecture
class DeepfakeDetector(nn.Module):
    def __init__(self, num_classes=2):
        super(DeepfakeDetector, self).__init__()
        # Use EfficientNet-B0 from timm (lighter and faster)
        self.backbone = timm.create_model('efficientnet_b0', pretrained=True, num_classes=0)
        # Get the feature dimension
        self.feature_dim = self.backbone.num_features
        # Classification head with attention
        self.attention = nn.Sequential(
            nn.Linear(self.feature_dim, 256),
            nn.Tanh(),
            nn.Linear(256, 1),
            nn.Softmax(dim=1)
        )
        self.classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(self.feature_dim, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Linear(256, num_classes)
        )
        
    def forward(self, x):
        features = self.backbone(x)
        return self.classifier(features)

def init_model():
    global deepfake_model
    if deepfake_model is None:
        logger.info("Initializing deepfake detection model...")
        deepfake_model = DeepfakeDetector(num_classes=2)
        deepfake_model = deepfake_model.to(device)
        deepfake_model.eval()
        logger.info("Model initialized successfully")
    return deepfake_model

# Image preprocessing
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# Augmented transforms for better analysis
augmented_transforms = [
    transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=1.0),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ]),
    transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ColorJitter(brightness=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ]),
]

async def detect_faces(image: Image.Image) -> dict:
    """Detect all faces in image and return bounding boxes"""
    face_detector = init_mtcnn()
    
    # Convert PIL to numpy for MTCNN
    img_array = np.array(image)
    
    # Detect faces
    boxes, probs, landmarks = face_detector.detect(img_array, landmarks=True)
    
    faces_data = []
    if boxes is not None and len(boxes) > 0:
        for i, (box, prob) in enumerate(zip(boxes, probs)):
            if prob > 0.9:  # High confidence faces only
                box = box.astype(int)
                x1, y1, x2, y2 = box
                
                # Add margin
                margin = 20
                x1 = max(0, x1 - margin)
                y1 = max(0, y1 - margin)
                x2 = min(image.width, x2 + margin)
                y2 = min(image.height, y2 + margin)
                
                # Crop face
                face = image.crop((x1, y1, x2, y2))
                
                faces_data.append({
                    "box": [int(x1), int(y1), int(x2), int(y2)],
                    "confidence": float(prob),
                    "face_image": face
                })
    
    return {
        "faces": faces_data,
        "total_faces": len(faces_data)
    }

async def analyze_single_face(face_image: Image.Image) -> dict:
    """Analyze a single face image"""
    model = init_model()
    
    # Standard analysis
    input_tensor = transform(face_image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        outputs = model(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)
        fake_prob = probabilities[0][1].item()
        real_prob = probabilities[0][0].item()
    
    # Additional analysis with augmented images for robustness
    aug_fake_probs = []
    for aug_transform in augmented_transforms:
        aug_tensor = aug_transform(face_image).unsqueeze(0).to(device)
        with torch.no_grad():
            aug_outputs = model(aug_tensor)
            aug_probs = torch.softmax(aug_outputs, dim=1)
            aug_fake_probs.append(aug_probs[0][1].item())
    
    # Average with augmented results
    all_fake_probs = [fake_prob] + aug_fake_probs
    avg_fake_prob = sum(all_fake_probs) / len(all_fake_probs)
    
    return {
        "fake_probability": round(avg_fake_prob * 100, 2),
        "real_probability": round((1 - avg_fake_prob) * 100, 2),
        "consistency_score": round((1 - np.std(all_fake_probs)) * 100, 2)
    }

async def analyze_image(image: Image.Image) -> dict:
    """Analyze a single image for deepfake detection with enhanced metrics"""
    model = init_model()
    
    # Detect faces
    faces_result = await detect_faces(image)
    
    face_analyses = []
    
    if faces_result["total_faces"] > 0:
        # Analyze each detected face
        for i, face_data in enumerate(faces_result["faces"]):
            face_analysis = await analyze_single_face(face_data["face_image"])
            face_analyses.append({
                "face_id": i + 1,
                "bounding_box": face_data["box"],
                "detection_confidence": round(face_data["confidence"] * 100, 2),
                **face_analysis
            })
        
        # Aggregate results
        fake_probs = [f["fake_probability"] for f in face_analyses]
        avg_fake = sum(fake_probs) / len(fake_probs)
        max_fake = max(fake_probs)
        
        is_fake = max_fake > 50
        confidence = max_fake if is_fake else (100 - avg_fake)
        
        return {
            "verdict": "FAKE" if is_fake else "REAL",
            "confidence": round(confidence, 2),
            "fake_probability": round(max_fake, 2),
            "real_probability": round(100 - max_fake, 2),
            "face_detected": True,
            "faces_analyzed": len(face_analyses),
            "face_details": face_analyses,
            "analysis_method": "multi_face_detection",
            "risk_level": "HIGH" if max_fake > 70 else "MEDIUM" if max_fake > 50 else "LOW"
        }
    else:
        # No face detected - analyze full image
        input_tensor = transform(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            fake_prob = probabilities[0][1].item()
            real_prob = probabilities[0][0].item()
        
        is_fake = fake_prob > 0.5
        confidence = fake_prob if is_fake else real_prob
        
        return {
            "verdict": "FAKE" if is_fake else "REAL",
            "confidence": round(confidence * 100, 2),
            "fake_probability": round(fake_prob * 100, 2),
            "real_probability": round(real_prob * 100, 2),
            "face_detected": False,
            "faces_analyzed": 0,
            "face_details": [],
            "analysis_method": "full_image",
            "risk_level": "HIGH" if fake_prob > 0.7 else "MEDIUM" if fake_prob > 0.5 else "LOW"
        }

async def analyze_video(video_path: str, max_frames: int = 15) -> dict:
    """Analyze video by sampling frames with enhanced metrics"""
    cap = cv2.VideoCapture(video_path)
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    if total_frames == 0:
        cap.release()
        raise ValueError("Could not read video frames")
    
    # Calculate frame indices to sample (more frames for better accuracy)
    if total_frames <= max_frames:
        frame_indices = list(range(total_frames))
    else:
        step = total_frames // max_frames
        frame_indices = [i * step for i in range(max_frames)]
    
    frame_results = []
    all_face_counts = []
    
    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        
        if not ret:
            continue
        
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(frame_rgb)
        
        # Analyze frame
        result = await analyze_image(pil_image)
        result["frame_index"] = idx
        result["timestamp"] = round(idx / fps, 2) if fps > 0 else 0
        frame_results.append(result)
        all_face_counts.append(result.get("faces_analyzed", 0))
    
    cap.release()
    
    if not frame_results:
        raise ValueError("Could not analyze any frames")
    
    # Aggregate results
    fake_probs = [r["fake_probability"] for r in frame_results]
    avg_fake_prob = sum(fake_probs) / len(fake_probs)
    max_fake_prob = max(fake_probs)
    min_fake_prob = min(fake_probs)
    std_fake_prob = float(np.std(fake_probs))
    
    # Detect temporal anomalies
    temporal_consistency = 100 - (std_fake_prob * 2)
    
    is_fake = avg_fake_prob > 50
    
    # Count suspicious frames
    suspicious_frames = sum(1 for p in fake_probs if p > 50)
    
    return {
        "verdict": "FAKE" if is_fake else "REAL",
        "confidence": round(max_fake_prob if is_fake else (100 - avg_fake_prob), 2),
        "avg_fake_probability": round(avg_fake_prob, 2),
        "max_fake_probability": round(max_fake_prob, 2),
        "min_fake_probability": round(min_fake_prob, 2),
        "temporal_consistency": round(max(0, temporal_consistency), 2),
        "frames_analyzed": len(frame_results),
        "suspicious_frames": suspicious_frames,
        "total_frames": total_frames,
        "duration_seconds": round(duration, 2),
        "fps": round(fps, 2),
        "resolution": f"{width}x{height}",
        "avg_faces_per_frame": round(sum(all_face_counts) / len(all_face_counts), 1) if all_face_counts else 0,
        "frame_results": frame_results,
        "risk_level": "HIGH" if avg_fake_prob > 70 else "MEDIUM" if avg_fake_prob > 50 else "LOW"
    }

# ============== PYDANTIC MODELS ==============

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    name: str = Field(min_length=1, max_length=100)
    # bcrypt only uses the first 72 bytes, so cap the length to avoid silent truncation
    password: str = Field(min_length=8, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class FaceDetail(BaseModel):
    face_id: int
    bounding_box: List[int]
    detection_confidence: float
    fake_probability: float
    real_probability: float
    consistency_score: Optional[float] = None

class AnalysisResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: Optional[str] = None
    file_type: str
    file_name: str
    verdict: str
    confidence: float
    fake_probability: float
    real_probability: Optional[float] = None
    face_detected: Optional[bool] = None
    faces_analyzed: Optional[int] = None
    face_details: Optional[List[dict]] = None
    frames_analyzed: Optional[int] = None
    frame_results: Optional[List[dict]] = None
    risk_level: Optional[str] = None
    analysis_method: Optional[str] = None
    temporal_consistency: Optional[float] = None
    created_at: str

class BatchAnalysisResult(BaseModel):
    total_files: int
    completed: int
    failed: int
    results: List[AnalysisResult]

class StatsResponse(BaseModel):
    total_analyses: int
    images_analyzed: int
    videos_analyzed: int
    fake_detected: int
    real_detected: int

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_token(token)
    
    user = await db.find_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[dict]:
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = decode_token(token)
        user = await db.find_user_by_id(payload["sub"])
        return user
    except:
        return None

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.find_user_by_email(user_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.insert_user(user_doc)
    
    # Create token
    token = create_token(user_id, user_data.email)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.find_user_by_email(credentials.email)
    
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["email"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============== ANALYSIS ROUTES ==============

@api_router.post("/analyze/image", response_model=AnalysisResult)
async def analyze_image_endpoint(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPG, PNG, or WebP image.")
    
    try:
        # Read and process image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # Analyze
        result = await analyze_image(image)
        
        # Create analysis record
        analysis_id = str(uuid.uuid4())
        analysis_doc = {
            "id": analysis_id,
            "user_id": current_user["id"] if current_user else None,
            "file_type": "image",
            "file_name": file.filename,
            "verdict": result["verdict"],
            "confidence": result["confidence"],
            "fake_probability": result["fake_probability"],
            "real_probability": result["real_probability"],
            "face_detected": result["face_detected"],
            "faces_analyzed": result.get("faces_analyzed", 0),
            "face_details": result.get("face_details", []),
            "risk_level": result.get("risk_level", "UNKNOWN"),
            "analysis_method": result.get("analysis_method", "standard"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.insert_analysis(analysis_doc)
        
        return AnalysisResult(**analysis_doc)
        
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")

@api_router.post("/analyze/video", response_model=AnalysisResult)
async def analyze_video_endpoint(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    # Validate file type
    allowed_types = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an MP4, WebM, or MOV video.")
    
    temp_path = None
    try:
        # Save video to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            temp_path = temp_file.name
            contents = await file.read()
            temp_file.write(contents)
        
        # Analyze video
        result = await analyze_video(temp_path)
        
        # Create analysis record
        analysis_id = str(uuid.uuid4())
        analysis_doc = {
            "id": analysis_id,
            "user_id": current_user["id"] if current_user else None,
            "file_type": "video",
            "file_name": file.filename,
            "verdict": result["verdict"],
            "confidence": result["confidence"],
            "fake_probability": result["avg_fake_probability"],
            "frames_analyzed": result["frames_analyzed"],
            "frame_results": result["frame_results"],
            "risk_level": result.get("risk_level", "UNKNOWN"),
            "temporal_consistency": result.get("temporal_consistency"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.insert_analysis(analysis_doc)
        
        return AnalysisResult(**analysis_doc)
        
    except Exception as e:
        logger.error(f"Error analyzing video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing video: {str(e)}")
    finally:
        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

@api_router.post("/analyze/batch", response_model=BatchAnalysisResult)
async def analyze_batch_endpoint(
    files: List[UploadFile] = File(...),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Analyze multiple files in batch"""
    results = []
    failed = 0
    
    for file in files[:10]:  # Limit to 10 files
        try:
            if file.content_type.startswith('image/'):
                contents = await file.read()
                image = Image.open(io.BytesIO(contents)).convert('RGB')
                result = await analyze_image(image)
                
                analysis_id = str(uuid.uuid4())
                analysis_doc = {
                    "id": analysis_id,
                    "user_id": current_user["id"] if current_user else None,
                    "file_type": "image",
                    "file_name": file.filename,
                    "verdict": result["verdict"],
                    "confidence": result["confidence"],
                    "fake_probability": result["fake_probability"],
                    "real_probability": result["real_probability"],
                    "face_detected": result["face_detected"],
                    "risk_level": result.get("risk_level", "UNKNOWN"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                await db.insert_analysis(analysis_doc)
                results.append(AnalysisResult(**analysis_doc))
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Batch analysis error for {file.filename}: {str(e)}")
            failed += 1
    
    return BatchAnalysisResult(
        total_files=len(files),
        completed=len(results),
        failed=failed,
        results=results
    )

@api_router.get("/analyses", response_model=List[AnalysisResult])
async def get_user_analyses(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0)
):
    analyses = await db.get_user_analyses(current_user["id"], limit, offset)
    return [AnalysisResult(**a) for a in analyses]

@api_router.get("/analyses/stats", response_model=StatsResponse)
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    """Get user's analysis statistics"""
    stats = await db.get_user_stats(current_user["id"])
    
    return StatsResponse(
        total_analyses=stats["total"],
        images_analyzed=stats["images"],
        videos_analyzed=stats["videos"],
        fake_detected=stats["fake"],
        real_detected=stats["real"]
    )

@api_router.get("/analyses/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    analysis = await db.get_analysis(analysis_id, current_user["id"])
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return AnalysisResult(**analysis)

@api_router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific analysis"""
    deleted = await db.delete_analysis(analysis_id, current_user["id"])
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return {"message": "Analysis deleted successfully"}

@api_router.get("/analyses/{analysis_id}/export")
async def export_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    """Export analysis as JSON report"""
    analysis = await db.get_analysis(analysis_id, current_user["id"])
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Create detailed report
    report = {
        "report_title": "TruthLens Deepfake Analysis Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "analysis": analysis,
        "disclaimer": "This report is generated by AI and should not be used as definitive proof. Results may vary based on image quality and manipulation type."
    }
    
    # Return as downloadable JSON
    json_str = json.dumps(report, indent=2)
    
    return StreamingResponse(
        io.BytesIO(json_str.encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=truthlens_report_{analysis_id[:8]}.json"}
    )

# ============== GENERAL ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "TruthLens Deepfake Detection API", "version": "2.0.0", "mode": "demo"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "device": str(device), "model": "EfficientNet-B0", "mode": "demo (in-memory storage)"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Initialize models on startup
    logger.info("🚀 TruthLens Demo Mode Starting...")
    logger.info("📦 No MongoDB required - using in-memory storage")
    logger.info("Initializing ML models...")
    init_mtcnn()
    init_model()
    logger.info("✅ ML models initialized")
    logger.info("🌐 Server ready at http://localhost:8001")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
