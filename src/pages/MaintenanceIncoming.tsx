import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { generateIssuePDF, getReportFileName } from '@/lib/generateIssuePDF';
import { 
  Inbox, 
  Clock, 
  AlertTriangle,
  Search,
  Loader2,
  Calendar,
  User,
  MapPin,
  ArrowRight,
  TrendingUp,
  Download
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type IssueStatus = 'submitted' | 'in_progress' | 'resolved';
type IssueSeverity = 'low' | 'medium' | 'high';
type IssueCategory = 'water_leak' | 'cleanliness' | 'furniture_damage' | 'electrical_issue' | 'others';

interface Issue {
  id: string;
  student_id: string;
  image_url: string | null;
  category: IssueCategory;
  severity: IssueSeverity;
  confidence: number | null;
  location: string | null;
  description: string | null;
  status: IssueStatus;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  water_leak: 'Water',
  water: 'Water',
  air_emission: 'Air',
  air: 'Air',
  waste: 'Waste',
  others: 'Waste',
};

const MaintenanceIncoming = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const { data, error } = await supabase
          .from('issues')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setIssues((data || []) as Issue[]);
      } catch (err) {
        console.error('Error fetching issues:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, []);

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = searchTerm === '' || 
      issue.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter;
    const matchesSeverity = severityFilter === 'all' || issue.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesSeverity && matchesStatus;
  });

  const getSeverityColor = (severity: IssueSeverity) => {
    switch (severity) {
      case 'low': return 'severity-badge-low';
      case 'medium': return 'severity-badge-medium';
      case 'high': return 'severity-badge-high';
    }
  };

  const getStatusColor = (status: IssueStatus) => {
    switch (status) {
      case 'submitted': return 'status-badge-submitted';
      case 'in_progress': return 'status-badge-in-progress';
      case 'resolved': return 'status-badge-resolved';
    }
  };

  // Download issue report as PDF
  const handleDownloadReport = async (issue: Issue, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation
    
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setDownloadingReportId(issue.id);

    try {
      // Fetch student profile
      const { data: studentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('name, email, registration_number, degree, department, phone_number')
        .eq('id', issue.student_id)
        .single();

      if (profileError || !studentProfile) {
        throw new Error('Failed to fetch student profile');
      }

      // Generate PDF
      const pdfBlob = await generateIssuePDF(
        {
          name: studentProfile.name,
          email: studentProfile.email,
          registration_number: studentProfile.registration_number,
          degree: studentProfile.degree,
          department: studentProfile.department,
          phone_number: studentProfile.phone_number,
        },
        {
          id: issue.id,
          category: issue.category,
          description: issue.description,
          severity: issue.severity,
          created_at: issue.created_at,
          location: issue.location,
          status: issue.status,
          updated_at: issue.created_at, // Use created_at if updated_at not available
          image_url: issue.image_url,
          resolved_image_url: null, // Not available in list view
        }
      );

      const fileName = getReportFileName(issue.id);
      const filePath = `${user.id}/${issue.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('issue-reports')
        .upload(filePath, pdfBlob, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('issue-reports')
        .getPublicUrl(filePath);

      // Save to downloaded_reports table
      const { error: dbError } = await supabase
        .from('downloaded_reports')
        .insert({
          user_id: user.id,
          issue_id: issue.id,
          issue_category: issue.category,
          location: issue.location,
          issue_status: issue.status,
          file_url: urlData.publicUrl,
          file_name: fileName,
        });

      if (dbError) throw dbError;

      // Download the file
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded and saved to My Works!');
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Failed to generate report');
    } finally {
      setDownloadingReportId(null);
    }
  };

  const stats = {
    total: issues.length,
    inProgress: issues.filter(i => i.status === 'in_progress').length,
    resolved: issues.filter(i => i.status === 'resolved').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Incoming Issues</h1>
            <p className="text-muted-foreground mt-1">
              View and manage newly submitted campus issues
            </p>
          </div>
          <Button onClick={() => navigate('/maintenance/work')} variant="outline" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Work & Resolution
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-muted/50 to-transparent border-border hover:shadow-lg transition-shadow group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Issues</p>
                  <p className="text-3xl font-bold mt-1">{stats.total}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <Inbox className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/10 to-transparent border-warning/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">In Progress</p>
                  <p className="text-3xl font-bold text-warning mt-1">{stats.inProgress}</p>
                </div>
                <div className="p-3 rounded-xl bg-warning/10">
                  <Loader2 className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-transparent border-success/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Resolved</p>
                  <p className="text-3xl font-bold text-success mt-1">{stats.resolved}</p>
                </div>
                <div className="p-3 rounded-xl bg-success/10">
                  <Clock className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by location or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[180px] h-11">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="air_emission">Air</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="others">Waste</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full md:w-[150px] h-11">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px] h-11">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Issues Table */}
        {loading ? (
          <Card className="shadow-lg">
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading issues...</p>
            </CardContent>
          </Card>
        ) : filteredIssues.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Inbox className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Issues Found</h3>
              <p className="text-muted-foreground">
                No issues match your current filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredIssues.map((issue) => (
              <Card 
                key={issue.id} 
                className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group border-l-4 border-l-transparent hover:border-l-primary"
                onClick={() => navigate(`/maintenance/work?issue=${issue.id}`)}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Image Thumbnail */}
                    {issue.image_url && (
                      <div className="sm:w-40 h-28 sm:h-auto bg-muted shrink-0 overflow-hidden">
                        <img
                          src={issue.image_url}
                          alt="Issue"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                              {categoryLabels[issue.category]}
                            </h3>
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                            <span className={`status-badge ${getStatusColor(issue.status)}`}>
                              {issue.status.replace('_', ' ')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                            {issue.location && (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-primary" />
                                {issue.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5">
                              <User className="h-4 w-4" />
                              {issue.student_id.slice(0, 8)}...
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4" />
                              {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Download Report Button */}
                          <div className="mt-3">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={(e) => handleDownloadReport(issue, e)}
                              disabled={downloadingReportId === issue.id}
                            >
                              {downloadingReportId === issue.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Download className="h-4 w-4" />
                                  Download Report
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        <Button variant="ghost" size="sm" className="gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          View
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MaintenanceIncoming;
