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
  Award
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

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
  
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState<IssueStatus | ''>('');
  const [adminComment, setAdminComment] = useState('');

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

      // Update local state
      setIssues(prev => prev.map(i => 
        i.id === selectedIssue.id 
          ? { ...i, status: newStatus, admin_comments: adminComment || null }
          : i
      ));
      setSelectedIssue(prev => prev ? { ...prev, status: newStatus, admin_comments: adminComment || null } : null);

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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Work & Resolution</h1>
          <p className="text-muted-foreground mt-1">
            Manage active issues and update their status
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Issues List */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Active Issues
                </CardTitle>
                <CardDescription>
                  {activeIssues.length} issues pending resolution
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  </div>
                ) : activeIssues.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
                    <p>All issues resolved!</p>
                  </div>
                ) : (
                  activeIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedIssue?.id === issue.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleSelectIssue(issue)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {categoryLabels[issue.category]}
                        </span>
                        <Badge className={`${getSeverityColor(issue.severity)} text-xs`}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                      </div>
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
                  <Card className="overflow-hidden">
                    <img
                      src={selectedIssue.image_url}
                      alt="Issue"
                      className="w-full h-64 object-cover"
                    />
                  </Card>
                )}

                {/* Issue Info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {categoryLabels[selectedIssue.category]}
                          <Badge className={getSeverityColor(selectedIssue.severity)}>
                            {selectedIssue.severity}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Issue ID: {selectedIssue.id.slice(0, 8)}...
                        </CardDescription>
                      </div>
                      <span className={`status-badge ${getStatusColor(selectedIssue.status)}`}>
                        {selectedIssue.status.replace('_', ' ')}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedIssue.location || 'No location specified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(selectedIssue.created_at), 'PPp')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Student: {selectedIssue.student_id.slice(0, 12)}...</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span>AI Confidence: {selectedIssue.confidence || 'N/A'}%</span>
                      </div>
                    </div>

                    {selectedIssue.description && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <p className="mt-1 text-sm">{selectedIssue.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Update Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Update Issue
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={newStatus} onValueChange={(v) => setNewStatus(v as IssueStatus)}>
                        <SelectTrigger>
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
                      <Label>Admin Comments</Label>
                      <Textarea
                        placeholder="Add notes about the resolution, work done, etc."
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        rows={4}
                      />
                    </div>

                    {newStatus === 'resolved' && selectedIssue.status !== 'resolved' && (
                      <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg">
                        <Award className="h-5 w-5 text-success" />
                        <span className="text-sm text-success">
                          Student will receive 10 points for this validated issue
                        </span>
                      </div>
                    )}

                    <Button 
                      onClick={handleUpdateIssue} 
                      className="w-full"
                      disabled={updating || !newStatus}
                    >
                      {updating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Update Issue
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select an Issue</h3>
                  <p className="text-muted-foreground">
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
