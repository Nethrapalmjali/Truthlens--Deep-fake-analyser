import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Shield, ArrowLeft, History, Image as ImageIcon, Video, 
  CheckCircle2, XCircle, Loader2, Calendar, BarChart3,
  Trash2, Download, AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const HistoryPage = () => {
  const { token } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analysesRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/analyses`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/analyses/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAnalyses(analysesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load analysis history');
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async (id) => {
    try {
      await axios.delete(`${API_URL}/analyses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalyses(prev => prev.filter(a => a.id !== id));
      toast.success('Analysis deleted');
    } catch (error) {
      toast.error('Failed to delete analysis');
    }
  };

  const exportReport = async (id) => {
    try {
      const response = await axios.get(`${API_URL}/analyses/${id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `truthlens_report_${id.slice(0, 8)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report exported');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRiskBadge = (riskLevel) => {
    const variants = {
      HIGH: 'bg-rose-100 text-rose-700 border-rose-200',
      MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
      LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    };
    return variants[riskLevel] || variants.LOW;
  };

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
            <Link to="/dashboard">
              <Button 
                variant="ghost"
                data-testid="back-to-dashboard"
                className="text-slate-600 hover:text-slate-900 text-sm font-medium inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Analyzer
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-slate-100 flex items-center justify-center">
            <History className="w-6 h-6 text-slate-900" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analysis History</h1>
            <p className="text-slate-600 text-sm">View and manage your past analyses</p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total</p>
              <p className="font-mono text-2xl font-bold">{stats.total_analyses}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Images</p>
              <p className="font-mono text-2xl font-bold">{stats.images_analyzed}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Videos</p>
              <p className="font-mono text-2xl font-bold">{stats.videos_analyzed}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">Real</p>
              <p className="font-mono text-2xl font-bold text-emerald-600">{stats.real_detected}</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 mb-1">Fake</p>
              <p className="font-mono text-2xl font-bold text-rose-600">{stats.fake_detected}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-20 border border-slate-200 bg-slate-50/50">
            <div className="w-16 h-16 bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <History className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-slate-500 mb-4">No analyses yet</p>
            <Link to="/dashboard">
              <Button 
                data-testid="start-analyzing-btn"
                className="bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 py-2 h-auto text-sm font-semibold tracking-wide uppercase"
              >
                Start Analyzing
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3" data-testid="analysis-history-list">
            {analyses.map((analysis) => (
              <div 
                key={analysis.id}
                className="border border-slate-200 bg-white hover:border-slate-300 transition-colors duration-200"
                data-testid={`analysis-item-${analysis.id}`}
              >
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    {/* File Type Icon */}
                    <div className={`w-12 h-12 flex items-center justify-center ${
                      analysis.verdict === 'FAKE' ? 'bg-rose-50' : 'bg-emerald-50'
                    }`}>
                      {analysis.file_type === 'video' ? (
                        <Video className={`w-6 h-6 ${
                          analysis.verdict === 'FAKE' ? 'text-rose-600' : 'text-emerald-600'
                        }`} strokeWidth={1.5} />
                      ) : (
                        <ImageIcon className={`w-6 h-6 ${
                          analysis.verdict === 'FAKE' ? 'text-rose-600' : 'text-emerald-600'
                        }`} strokeWidth={1.5} />
                      )}
                    </div>

                    {/* File Info */}
                    <div>
                      <p className="font-medium text-slate-900 mb-1 truncate max-w-[250px]">
                        {analysis.file_name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="uppercase">{analysis.file_type}</span>
                        <span>&bull;</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(analysis.created_at)}
                        </div>
                        {analysis.risk_level && (
                          <>
                            <span>&bull;</span>
                            <Badge className={`${getRiskBadge(analysis.risk_level)} border text-xs`}>
                              {analysis.risk_level}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Confidence
                      </p>
                      <p className="font-mono text-xl font-bold">
                        {analysis.confidence}%
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 ${
                      analysis.verdict === 'FAKE' ? 'bg-rose-50' : 'bg-emerald-50'
                    }`}>
                      {analysis.verdict === 'FAKE' ? (
                        <XCircle className="w-5 h-5 text-rose-600" strokeWidth={1.5} />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
                      )}
                      <span className={`font-mono font-bold ${
                        analysis.verdict === 'FAKE' ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {analysis.verdict}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportReport(analysis.id)}
                        data-testid={`export-${analysis.id}`}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAnalysis(analysis.id)}
                        data-testid={`delete-${analysis.id}`}
                        className="text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                {(analysis.frames_analyzed || analysis.faces_analyzed !== undefined) && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-4 text-xs text-slate-500">
                    {analysis.frames_analyzed && (
                      <span>{analysis.frames_analyzed} frames analyzed</span>
                    )}
                    {analysis.faces_analyzed !== undefined && (
                      <span>{analysis.faces_analyzed} face{analysis.faces_analyzed !== 1 ? 's' : ''} detected</span>
                    )}
                    {analysis.temporal_consistency && (
                      <span>Temporal consistency: {analysis.temporal_consistency}%</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HistoryPage;
