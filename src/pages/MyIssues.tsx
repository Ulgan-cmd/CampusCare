import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Loader2, 
  AlertTriangle,
  MapPin,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type IssueStatus = 'submitted' | 'in_progress' | 'resolved';
type IssueSeverity = 'low' | 'medium' | 'high';
type IssueCategory = 'water_leak' | 'cleanliness' | 'furniture_damage' | 'electrical_issue' | 'others';

interface Issue {
  id: string;
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

const statusConfig: Record<IssueStatus, { label: string; class: string; icon: React.ReactNode }> = {
  submitted: { 
    label: 'Submitted', 
    class: 'status-badge-submitted',
    icon: <Clock className="h-3 w-3" />
  },
  in_progress: { 
    label: 'In Progress', 
    class: 'status-badge-in-progress',
    icon: <Loader2 className="h-3 w-3 animate-spin" />
  },
  resolved: { 
    label: 'Resolved', 
    class: 'status-badge-resolved',
    icon: <CheckCircle className="h-3 w-3" />
  },
};

const MyIssues = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IssueStatus | 'all'>('all');

  useEffect(() => {
    const fetchIssues = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('issues')
          .select('*')
          .eq('student_id', user.id)
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
  }, [user]);

  const filteredIssues = filter === 'all' 
    ? issues 
    : issues.filter(issue => issue.status === filter);

  const getStatusCounts = () => {
    return {
      all: issues.length,
      submitted: issues.filter(i => i.status === 'submitted').length,
      in_progress: issues.filter(i => i.status === 'in_progress').length,
      resolved: issues.filter(i => i.status === 'resolved').length,
    };
  };

  const counts = getStatusCounts();

  const getSeverityColor = (severity: IssueSeverity) => {
    switch (severity) {
      case 'low': return 'severity-badge-low';
      case 'medium': return 'severity-badge-medium';
      case 'high': return 'severity-badge-high';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Issues</h1>
            <p className="text-muted-foreground mt-1">
              Track the status of your reported issues
            </p>
          </div>
          <Button onClick={() => navigate('/report')}>
            Report New Issue
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'submitted', 'in_progress', 'resolved'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
              className="gap-2"
            >
              {status === 'all' ? 'All' : statusConfig[status as IssueStatus].label}
              <Badge variant="secondary" className="ml-1">
                {counts[status]}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Issues List */}
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your issues...</p>
            </CardContent>
          </Card>
        ) : filteredIssues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'all' 
                  ? "You haven't reported any issues yet." 
                  : `No ${filter.replace('_', ' ')} issues.`}
              </p>
              {filter === 'all' && (
                <Button onClick={() => navigate('/report')}>
                  Report Your First Issue
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredIssues.map((issue) => (
              <Card key={issue.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Image */}
                    {issue.image_url && (
                      <div className="sm:w-48 h-32 sm:h-auto bg-muted shrink-0">
                        <img
                          src={issue.image_url}
                          alt="Issue"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {categoryLabels[issue.category]}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                            <span className={`status-badge ${statusConfig[issue.status].class}`}>
                              {statusConfig[issue.status].icon}
                              <span className="ml-1">{statusConfig[issue.status].label}</span>
                            </span>
                            {issue.confidence && (
                              <span className="text-xs text-muted-foreground">
                                {issue.confidence}% AI confidence
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {issue.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{issue.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Reported {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>

                      {issue.admin_comments && (
                        <div className="mt-3 p-3 bg-muted rounded-lg">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Admin Comments:</p>
                          <p className="text-sm">{issue.admin_comments}</p>
                        </div>
                      )}

                      {/* Status Progress */}
                      <div className="mt-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 flex-1 rounded-full ${
                            issue.status === 'submitted' ? 'bg-primary' : 'bg-primary'
                          }`} />
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className={`h-2 flex-1 rounded-full ${
                            issue.status === 'in_progress' || issue.status === 'resolved' 
                              ? 'bg-warning' 
                              : 'bg-muted'
                          }`} />
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className={`h-2 flex-1 rounded-full ${
                            issue.status === 'resolved' ? 'bg-success' : 'bg-muted'
                          }`} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Submitted</span>
                          <span>In Progress</span>
                          <span>Resolved</span>
                        </div>
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

export default MyIssues;
