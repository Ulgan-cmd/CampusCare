import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { generateIssuePDF, getReportFileName } from '@/lib/generateIssuePDF';
import { 
  Wrench, 
  CheckCircle, 
  Loader2,
  AlertTriangle,
  MapPin,
  Calendar,
  User,
  MessageSquare,
  Award,
  Clock,
  ArrowLeft,
  Camera,
  Upload,
  Image as ImageIcon,
  Mail,
  GraduationCap,
  Hash,
  Download
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type IssueStatus = 'submitted' | 'in_progress' | 'resolved';
type IssueSeverity = 'low' | 'medium' | 'high';
type IssueCategory = 'water_leak' | 'cleanliness' | 'furniture_damage' | 'electrical_issue' | 'others';

interface Issue {
  id: string;
  student_id: string;
  image_url: string | null;
  resolved_image_url: string | null;
  category: IssueCategory;
  severity: IssueSeverity;
  confidence: number | null;
  location: string | null;
  description: string | null;
  status: IssueStatus;
  admin_comments: string | null;
  created_at: string;
  updated_at: string;
}

interface StudentProfile {
  name: string | null;
  email: string;
  registration_number: string | null;
  degree: string | null;
  department: string | null;
}

const categoryLabels: Record<string, string> = {
  water_leak: 'Water',
  water: 'Water',
  cleanliness: 'Cleanliness',
  furniture_damage: 'Furniture Damage',
  electrical_issue: 'Electrical Issue',
  fire_safety: 'Fire Safety',
  civil_work: 'Civil Work',
  air_emission: 'Air Emission',
  others: 'Others',
};

const MaintenanceWork = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const issueId = searchParams.get('issue');
  const navigate = useNavigate();
  const resolvedImageInputRef = useRef<HTMLInputElement>(null);
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<IssueStatus | ''>('');
  const [adminComment, setAdminComment] = useState('');
  const [previousStatus, setPreviousStatus] = useState<IssueStatus | ''>('');
  const [resolvedImageFile, setResolvedImageFile] = useState<File | null>(null);
  const [resolvedImagePreview, setResolvedImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Fetch student profile when issue is selected
  const fetchStudentProfile = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email, registration_number, degree, department')
        .eq('id', studentId)
        .single();

      if (error) throw error;
      setStudentProfile(data);
    } catch (err) {
      console.error('Error fetching student profile:', err);
      setStudentProfile(null);
    }
  };

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const { data, error } = await supabase
          .from('issues')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        const issueData = (data || []) as Issue[];
        setIssues(issueData);

        // If issueId is provided, select that issue
        if (issueId) {
          const issue = issueData.find(i => i.id === issueId);
          if (issue) {
            setSelectedIssue(issue);
            setNewStatus(issue.status);
            setPreviousStatus(issue.status);
            setAdminComment(issue.admin_comments || '');
            fetchStudentProfile(issue.student_id);
          }
        }
      } catch (err) {
        console.error('Error fetching issues:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [issueId]);

  const handleSelectIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setNewStatus(issue.status);
    setPreviousStatus(issue.status);
    setAdminComment(issue.admin_comments || '');
    setResolvedImageFile(null);
    setResolvedImagePreview(null);
    fetchStudentProfile(issue.student_id);
  };

  const handleResolvedImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResolvedImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setResolvedImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateIssue = async () => {
    if (!selectedIssue || !newStatus) return;

    // Require resolved image when marking as resolved
    if (newStatus === 'resolved' && previousStatus !== 'resolved' && !resolvedImageFile) {
      toast.error('Please upload a proof photo of the resolved issue');
      return;
    }

    setUpdating(true);

    try {
      let resolvedImageUrl = selectedIssue.resolved_image_url;

      // Upload resolved image if provided
      if (resolvedImageFile && newStatus === 'resolved') {
        setUploadingImage(true);
        const ext = resolvedImageFile.name.split('.').pop();
        const fileName = `resolved/${selectedIssue.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('issue-images')
          .upload(fileName, resolvedImageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('issue-images')
          .getPublicUrl(fileName);

        resolvedImageUrl = urlData.publicUrl;
        setUploadingImage(false);
      }

      const updates: { status: IssueStatus; admin_comments: string | null; resolved_image_url?: string | null } = {
        status: newStatus,
        admin_comments: adminComment || null,
      };

      if (resolvedImageUrl) {
        updates.resolved_image_url = resolvedImageUrl;
      }

      const { error } = await supabase
        .from('issues')
        .update(updates)
        .eq('id', selectedIssue.id);

      if (error) throw error;

      // Award 50 points if status changed to resolved
      if (newStatus === 'resolved' && previousStatus !== 'resolved') {
        await supabase.rpc('increment_points', { 
          user_id: selectedIssue.student_id, 
          points_to_add: 50 
        });
      }

      // Update local state
      setIssues(prev => prev.map(i => 
        i.id === selectedIssue.id 
          ? { ...i, status: newStatus, admin_comments: adminComment || null, resolved_image_url: resolvedImageUrl }
          : i
      ));
      setSelectedIssue(prev => prev ? { ...prev, status: newStatus, admin_comments: adminComment || null, resolved_image_url: resolvedImageUrl } : null);
      setPreviousStatus(newStatus);
      setResolvedImageFile(null);
      setResolvedImagePreview(null);

      toast.success('Issue updated successfully!');
    } catch (err) {
      console.error('Error updating issue:', err);
      toast.error('Failed to update issue');
    } finally {
      setUpdating(false);
      setUploadingImage(false);
    }
  };

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
  const handleDownloadReport = async () => {
    if (!selectedIssue || !studentProfile || !user) {
      toast.error('Issue or profile data not available');
      return;
    }

    setDownloadingReport(true);

    try {
      // Fetch phone number for the student profile
      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', selectedIssue.student_id)
        .single();

      // Generate PDF
      const pdfBlob = await generateIssuePDF(
        {
          ...studentProfile,
          phone_number: fullProfile?.phone_number || null,
        },
        {
          id: selectedIssue.id,
          category: selectedIssue.category,
          description: selectedIssue.description,
          severity: selectedIssue.severity,
          created_at: selectedIssue.created_at,
          location: selectedIssue.location,
          status: selectedIssue.status,
          updated_at: selectedIssue.updated_at,
          image_url: selectedIssue.image_url,
          resolved_image_url: selectedIssue.resolved_image_url,
        }
      );

      const fileName = getReportFileName(selectedIssue.id);
      const filePath = `${user.id}/${selectedIssue.id}/${fileName}`;

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
          issue_id: selectedIssue.id,
          issue_category: selectedIssue.category,
          location: selectedIssue.location,
          issue_status: selectedIssue.status,
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
      setDownloadingReport(false);
    }
  };

  const activeIssues = issues.filter(i => i.status !== 'resolved');

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Work & Resolution</h1>
            <p className="text-muted-foreground mt-1">
              Manage active issues and update their status
            </p>
          </div>
          <Button onClick={() => navigate('/maintenance/incoming')} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Incoming
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Issues List */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-lg">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                    <Wrench className="h-5 w-5" />
                  </div>
                  Active Issues
                </CardTitle>
                <CardDescription>
                  {activeIssues.length} issues pending resolution
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[600px] overflow-y-auto pt-4">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  </div>
                ) : activeIssues.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-success" />
                    </div>
                    <p className="font-medium">All issues resolved!</p>
                    <p className="text-sm mt-1">Great work team!</p>
                  </div>
                ) : (
                  activeIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedIssue?.id === issue.id 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectIssue(issue)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {categoryLabels[issue.category]}
                        </span>
                        <Badge className={`${getSeverityColor(issue.severity)} text-xs`}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                      </div>
                      {issue.location && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          {issue.location}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Issue Details */}
          <div className="lg:col-span-2">
            {selectedIssue ? (
              <div className="space-y-4">
                {/* Issue Image */}
                {selectedIssue.image_url && (
                  <Card className="overflow-hidden shadow-lg">
                    <img
                      src={selectedIssue.image_url}
                      alt="Issue"
                      className="w-full h-72 object-cover"
                    />
                  </Card>
                )}

                {/* Issue Info */}
                <Card className="shadow-lg">
                  <CardHeader className="border-b border-border">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="flex items-center gap-3 text-2xl">
                          {categoryLabels[selectedIssue.category]}
                          <Badge className={`${getSeverityColor(selectedIssue.severity)} text-sm`}>
                            {selectedIssue.severity}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Issue ID: {selectedIssue.id.slice(0, 8)}...
                        </CardDescription>
                      </div>
                      <span className={`status-badge ${getStatusColor(selectedIssue.status)} text-sm px-4 py-1.5`}>
                        {selectedIssue.status.replace('_', ' ')}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {/* Student Info Section */}
                    {studentProfile && (
                      <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
                          <User className="h-4 w-4" />
                          Student Information
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Name</p>
                              <p className="font-medium text-sm">{studentProfile.name || 'Not provided'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium text-sm">{studentProfile.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Registration Number</p>
                              <p className="font-medium text-sm">{studentProfile.registration_number || 'Not provided'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Degree / Department</p>
                              <p className="font-medium text-sm">{studentProfile.degree || ''} {studentProfile.department ? `/ ${studentProfile.department}` : ''}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Download Report Button */}
                        <div className="flex justify-end pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleDownloadReport}
                            disabled={downloadingReport}
                            className="gap-2"
                          >
                            {downloadingReport ? (
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
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <MapPin className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Location</p>
                          <p className="font-medium">{selectedIssue.location || 'Not specified'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <Calendar className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Reported</p>
                          <p className="font-medium">{format(new Date(selectedIssue.created_at), 'PPp')}</p>
                        </div>
                      </div>
                    </div>

                    {selectedIssue.description && (
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <p className="mt-1">{selectedIssue.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Update Form */}
                <Card className="shadow-lg">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      Update Issue
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <Select value={newStatus} onValueChange={(v) => setNewStatus(v as IssueStatus)}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Admin Comments</Label>
                      <Textarea
                        placeholder="Add notes about the resolution, work done, etc."
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>

                    {/* Resolved Image Upload - Required when marking as resolved */}
                    {newStatus === 'resolved' && previousStatus !== 'resolved' && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Resolution Proof Photo <span className="text-destructive">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Upload a photo showing the issue has been resolved for student transparency.
                        </p>
                        
                        {resolvedImagePreview ? (
                          <div 
                            className="border-2 border-primary rounded-xl p-3 bg-primary/5 cursor-pointer"
                            onClick={() => resolvedImageInputRef.current?.click()}
                          >
                            <img
                              src={resolvedImagePreview}
                              alt="Resolved Preview"
                              className="max-h-40 mx-auto rounded-lg"
                            />
                            <p className="text-xs text-muted-foreground text-center mt-2">Click to change</p>
                          </div>
                        ) : (
                          <div
                            onClick={() => resolvedImageInputRef.current?.click()}
                            className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                          >
                            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm font-medium">Click to upload photo</p>
                            <p className="text-xs text-muted-foreground mt-1">Proof of resolution required</p>
                          </div>
                        )}
                        
                        <input
                          ref={resolvedImageInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleResolvedImageSelect}
                          className="hidden"
                        />
                      </div>
                    )}

                    {newStatus === 'resolved' && previousStatus !== 'resolved' && (
                      <div className="flex items-center gap-3 p-4 bg-[hsl(142,76%,36%,0.1)] rounded-xl border border-[hsl(142,76%,36%,0.2)]">
                        <div className="p-2 rounded-lg bg-[hsl(142,76%,36%)] text-white">
                          <Award className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-[hsl(142,76%,36%)]">
                          Student will receive 50 points for this resolved issue
                        </span>
                      </div>
                    )}

                    <Button 
                      onClick={handleUpdateIssue} 
                      className="w-full h-12 text-lg font-semibold shadow-lg"
                      disabled={updating || !newStatus}
                    >
                      {updating ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-5 w-5" />
                          Update Issue
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                    <Wrench className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Select an Issue</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Choose an issue from the list to view details and manage its status.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MaintenanceWork;
