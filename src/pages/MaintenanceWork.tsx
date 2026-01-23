import { useEffect, useState } from 'react';
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
  ArrowLeft
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

const categoryLabels: Record<IssueCategory, string> = {
  water_leak: 'Water Leak',
  cleanliness: 'Cleanliness',
  furniture_damage: 'Furniture Damage',
  electrical_issue: 'Electrical Issue',
  others: 'Others',
};

const MaintenanceWork = () => {
  const [searchParams] = useSearchParams();
  const issueId = searchParams.get('issue');
  const navigate = useNavigate();
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<IssueStatus | ''>('');
  const [adminComment, setAdminComment] = useState('');
  const [previousStatus, setPreviousStatus] = useState<IssueStatus | ''>('');

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
  };

  const handleUpdateIssue = async () => {
    if (!selectedIssue || !newStatus) return;

    setUpdating(true);

    try {
      const updates: Partial<Issue> = {
        status: newStatus,
        admin_comments: adminComment || null,
      };

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
          ? { ...i, status: newStatus, admin_comments: adminComment || null }
          : i
      ));
      setSelectedIssue(prev => prev ? { ...prev, status: newStatus, admin_comments: adminComment || null } : null);
      setPreviousStatus(newStatus);

      toast.success('Issue updated successfully!');
    } catch (err) {
      console.error('Error updating issue:', err);
      toast.error('Failed to update issue');
    } finally {
      setUpdating(false);
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
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Student ID</p>
                          <p className="font-medium">{selectedIssue.student_id.slice(0, 12)}...</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <p className="font-medium">{selectedIssue.confidence || 'N/A'}%</p>
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

                    {newStatus === 'resolved' && selectedIssue.status !== 'resolved' && (
                      <div className="flex items-center gap-3 p-4 bg-success/10 rounded-xl border border-success/20">
                        <div className="p-2 rounded-lg bg-success text-success-foreground">
                          <Award className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-success">
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
