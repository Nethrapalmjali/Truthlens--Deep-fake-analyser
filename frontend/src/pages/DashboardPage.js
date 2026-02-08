import React, { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  Shield, Upload, Image as ImageIcon, Video, LogOut, History, 
  X, CheckCircle2, XCircle, AlertCircle, Loader2, Download,
  Layers, Eye, BarChart3, Clock, Trash2, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardPage = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const batchInputRef = useRef(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('single');
  const [batchResults, setBatchResults] = useState([]);

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (activeTab === 'batch') {
      handleBatchSelect(droppedFiles);
    } else if (droppedFiles[0]) {
      handleFileSelect(droppedFiles[0]);
    }
  }, [activeTab]);

  const handleFileSelect = (selectedFile) => {
    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Please upload an image or video file');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setFiles([selectedFile]);
    setResult(null);
    setBatchResults([]);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleBatchSelect = (selectedFiles) => {
    const validFiles = selectedFiles.filter(f => 
      f.type.startsWith('image/') && f.size <= 50 * 1024 * 1024
    ).slice(0, 10);

    if (validFiles.length === 0) {
      toast.error('No valid image files selected');
      return;
    }

    if (validFiles.length < selectedFiles.length) {
      toast.warning(`Only ${validFiles.length} valid images selected (max 10)`);
    }

    setFiles(validFiles);
    setResult(null);
    setBatchResults([]);
    setPreview(null);
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleBatchInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleBatchSelect(selectedFiles);
  };

  const clearFiles = () => {
    setFiles([]);
    setPreview(null);
    setResult(null);
    setBatchResults([]);
  };

  const analyzeFile = async () => {
    if (files.length === 0) return;

    setAnalyzing(true);
    setProgress(0);
    setResult(null);
    setBatchResults([]);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);

    try {
      if (activeTab === 'batch' && files.length > 1) {
        // Batch analysis
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        const response = await axios.post(`${API_URL}/analyze/batch`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });

        clearInterval(progressInterval);
        setProgress(100);
        setBatchResults(response.data.results);
        toast.success(`Analyzed ${response.data.completed} of ${response.data.total_files} files`);
      } else {
        // Single file analysis
        const file = files[0];
        const formData = new FormData();
        formData.append('file', file);

        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? '/analyze/video' : '/analyze/image';

        const response = await axios.post(`${API_URL}${endpoint}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });

        clearInterval(progressInterval);
        setProgress(100);
        setResult(response.data);
        toast.success('Analysis complete!');
      }
    } catch (error) {
      clearInterval(progressInterval);
      setProgress(0);
      const errorMessage = error.response?.data?.detail || error.message || 'Analysis failed. Please try again.';
      toast.error(errorMessage);
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const exportReport = async (analysisId) => {
    if (!token) {
      toast.error('Please login to export reports');
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/analyses/${analysisId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `truthlens_report_${analysisId.slice(0, 8)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const getRiskBadge = (riskLevel) => {
    const variants = {
      HIGH: 'bg-rose-100 text-rose-700 border-rose-200',
      MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
      LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    };
    return variants[riskLevel] || variants.LOW;
  };

  const pieData = result ? [
    { name: 'Real', value: result.real_probability || (100 - result.fake_probability), color: '#10B981' },
    { name: 'Fake', value: result.fake_probability, color: '#F43F5E' }
  ] : [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <Shield className="w-7 h-7 text-slate-900" strokeWidth={1.5} />
              <span className="font-black text-xl tracking-tight">TRUTHLENS</span>
            </Link>
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <Link to="/history">
                    <Button 
                      variant="ghost"
                      data-testid="history-btn"
                      className="text-slate-600 hover:text-slate-900 text-sm font-medium inline-flex items-center gap-2"
                    >
                      <History className="w-4 h-4" />
                      History
                    </Button>
                  </Link>
                  <div className="h-6 w-px bg-slate-200" />
                  <span className="text-sm text-slate-500">{user.name}</span>
                  <Button 
                    variant="ghost"
                    onClick={handleLogout}
                    data-testid="logout-btn"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </>
              )}
              {!user && (
                <Link to="/login">
                  <Button 
                    variant="outline"
                    data-testid="login-btn"
                    className="text-sm font-medium"
                  >
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Analyze Media
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  Detect deepfake manipulation in images and videos
                </p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                <TabsTrigger value="single" className="data-[state=active]:bg-white">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Single File
                </TabsTrigger>
                <TabsTrigger value="batch" className="data-[state=active]:bg-white">
                  <Layers className="w-4 h-4 mr-2" />
                  Batch Upload
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Upload Zone */}
            <div
              data-testid="upload-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative min-h-[350px] border-2 border-dashed transition-all duration-300
                flex flex-col items-center justify-center p-6
                ${isDragging 
                  ? 'border-slate-900 bg-slate-50 upload-zone-active' 
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }
                ${files.length > 0 ? 'border-solid' : ''}
              `}
            >
              {files.length > 0 ? (
                <div className="w-full">
                  {/* Preview */}
                  {activeTab === 'single' && preview && (
                    <div className="relative mb-4">
                      {files[0]?.type.startsWith('image/') ? (
                        <img 
                          src={preview} 
                          alt="Preview" 
                          className="max-h-48 mx-auto object-contain rounded"
                          data-testid="image-preview"
                        />
                      ) : (
                        <video 
                          src={preview} 
                          className="max-h-48 mx-auto rounded" 
                          controls
                          data-testid="video-preview"
                        />
                      )}
                      <button
                        onClick={clearFiles}
                        data-testid="clear-file-btn"
                        className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
                      >
                        <X className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  )}

                  {/* Batch Preview */}
                  {activeTab === 'batch' && files.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-700">
                          {files.length} file{files.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                          onClick={clearFiles}
                          data-testid="clear-batch-btn"
                          className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-2 max-h-32 overflow-auto">
                        {files.map((file, idx) => (
                          <div key={idx} className="aspect-square bg-slate-100 rounded flex items-center justify-center overflow-hidden">
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Info */}
                  {activeTab === 'single' && (
                    <div className="flex items-center justify-center gap-3 mb-4 text-sm text-slate-600">
                      {files[0]?.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4" />
                      ) : (
                        <Video className="w-4 h-4" />
                      )}
                      <span className="font-medium truncate max-w-[200px]">{files[0]?.name}</span>
                      <span className="text-slate-400">
                        ({(files[0]?.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {analyzing && (
                    <div className="mb-4">
                      <Progress value={progress} className="h-2" />
                      <p className="text-center text-sm text-slate-500 mt-2">
                        {progress < 90 ? 'Processing...' : 'Finalizing...'}
                      </p>
                    </div>
                  )}

                  {/* Analyze Button */}
                  <Button
                    onClick={analyzeFile}
                    disabled={analyzing}
                    data-testid="analyze-btn"
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-8 py-5 h-auto text-sm font-semibold tracking-wide uppercase"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Analyze {activeTab === 'batch' ? `${files.length} Files` : 'File'}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 bg-slate-100 flex items-center justify-center mb-4">
                    <Upload className="w-7 h-7 text-slate-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-base font-semibold text-slate-900 mb-1">
                    {activeTab === 'batch' ? 'Drop multiple images' : 'Drop evidence here'}
                  </p>
                  <p className="text-slate-500 text-sm mb-4">
                    or click to browse files
                  </p>
                  <input
                    type="file"
                    accept={activeTab === 'batch' ? 'image/*' : 'image/*,video/*'}
                    multiple={activeTab === 'batch'}
                    onChange={activeTab === 'batch' ? handleBatchInput : handleFileInput}
                    className="hidden"
                    ref={activeTab === 'batch' ? batchInputRef : fileInputRef}
                    data-testid="file-input"
                  />
                  <Button 
                    onClick={() => activeTab === 'batch' ? batchInputRef.current?.click() : fileInputRef.current?.click()}
                    variant="outline"
                    className="bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-sm px-6 py-2 h-auto text-sm font-semibold tracking-wide uppercase"
                  >
                    Select {activeTab === 'batch' ? 'Images' : 'File'}
                  </Button>
                  <p className="text-xs text-slate-400 mt-4">
                    {activeTab === 'batch' 
                      ? 'Up to 10 images (JPG, PNG, WebP) - max 50MB each'
                      : 'JPG, PNG, WebP, MP4, WebM, MOV (max 50MB)'
                    }
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Analysis Result
              </h2>
              {result && user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportReport(result.id)}
                  data-testid="export-btn"
                  className="text-slate-600 hover:text-slate-900"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              )}
            </div>

            {/* Single Result */}
            {result ? (
              <div className="border border-slate-200 bg-white" data-testid="analysis-result">
                {/* Verdict Header */}
                <div className={`p-6 ${result.verdict === 'FAKE' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {result.verdict === 'FAKE' ? (
                        <div className="w-14 h-14 bg-rose-100 flex items-center justify-center">
                          <XCircle className="w-8 h-8 text-rose-600" strokeWidth={1.5} />
                        </div>
                      ) : (
                        <div className="w-14 h-14 bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600" strokeWidth={1.5} />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Verdict
                        </p>
                        <p 
                          className={`font-mono text-3xl font-bold tracking-tighter ${
                            result.verdict === 'FAKE' ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                          data-testid="verdict-text"
                        >
                          {result.verdict}
                        </p>
                      </div>
                    </div>
                    {result.risk_level && (
                      <Badge className={`${getRiskBadge(result.risk_level)} border`}>
                        {result.risk_level} RISK
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200">
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Confidence
                    </p>
                    <p className="font-mono text-2xl font-bold" data-testid="confidence-value">
                      {result.confidence}%
                    </p>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Fake Probability
                    </p>
                    <p className="font-mono text-2xl font-bold text-rose-600" data-testid="fake-probability">
                      {result.fake_probability}%
                    </p>
                  </div>
                </div>

                {/* Pie Chart */}
                <div className="p-5 border-t border-slate-200">
                  <div className="h-32 flex items-center justify-center">
                    <ResponsiveContainer width="50%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                        <span>Real: {pieData[0]?.value?.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-rose-500 rounded-sm" />
                        <span>Fake: {pieData[1]?.value?.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="p-5 border-t border-slate-200 bg-slate-50/50 space-y-2">
                  {result.faces_analyzed !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Eye className="w-4 h-4" />
                      <span>{result.faces_analyzed} face{result.faces_analyzed !== 1 ? 's' : ''} analyzed</span>
                    </div>
                  )}
                  {result.face_detected === false && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>No face detected - analyzed full image</span>
                    </div>
                  )}
                  {result.frames_analyzed && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Video className="w-4 h-4" />
                      <span>{result.frames_analyzed} frames analyzed</span>
                    </div>
                  )}
                  {result.temporal_consistency && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="w-4 h-4" />
                      <span>Temporal consistency: {result.temporal_consistency}%</span>
                    </div>
                  )}
                </div>

                {/* Face Details */}
                {result.face_details && result.face_details.length > 0 && (
                  <div className="p-5 border-t border-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      Face Details
                    </p>
                    <div className="space-y-2">
                      {result.face_details.map((face, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded text-sm">
                          <span className="font-medium">Face #{face.face_id}</span>
                          <div className="flex items-center gap-4">
                            <span className={face.fake_probability > 50 ? 'text-rose-600' : 'text-emerald-600'}>
                              {face.fake_probability.toFixed(1)}% fake
                            </span>
                            <span className="text-slate-400">
                              {face.detection_confidence.toFixed(0)}% detected
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Video Frame Chart */}
                {result.frame_results && result.frame_results.length > 0 && (
                  <div className="p-5 border-t border-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      Frame Analysis
                    </p>
                    <div className="h-40" data-testid="frame-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.frame_results}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="timestamp" 
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `${v}s`}
                          />
                          <YAxis 
                            domain={[0, 100]}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #E2E8F0',
                              fontSize: 12,
                              borderRadius: 0
                            }}
                            formatter={(value) => [`${value}%`, 'Fake Probability']}
                            labelFormatter={(v) => `Time: ${v}s`}
                          />
                          <defs>
                            <linearGradient id="colorFake" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area 
                            type="monotone" 
                            dataKey="fake_probability" 
                            stroke="#F43F5E" 
                            fill="url(#colorFake)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : batchResults.length > 0 ? (
              /* Batch Results */
              <div className="border border-slate-200 bg-white" data-testid="batch-results">
                <div className="p-5 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-semibold">Batch Analysis Results</h3>
                  <p className="text-sm text-slate-600">{batchResults.length} files analyzed</p>
                </div>
                <div className="divide-y divide-slate-200 max-h-[500px] overflow-auto">
                  {batchResults.map((item, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 flex items-center justify-center ${
                          item.verdict === 'FAKE' ? 'bg-rose-50' : 'bg-emerald-50'
                        }`}>
                          {item.verdict === 'FAKE' ? (
                            <XCircle className="w-5 h-5 text-rose-600" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">{item.file_name}</p>
                          <p className="text-xs text-slate-500">
                            {item.faces_analyzed || 0} faces detected
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold ${
                          item.verdict === 'FAKE' ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {item.verdict}
                        </p>
                        <p className="text-xs text-slate-500">{item.confidence}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 bg-slate-50/50 min-h-[350px] flex flex-col items-center justify-center p-6">
                <div className="w-14 h-14 bg-slate-100 flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="text-slate-400 text-center text-sm">
                  Upload a file to see analysis results
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>Note:</strong> Results are AI predictions and may not be 100% accurate. 
                Do not use as definitive proof. Model uses pretrained weights for demonstration.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
