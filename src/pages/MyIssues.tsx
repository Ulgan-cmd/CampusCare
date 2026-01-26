import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Loader2, 
  MapPin,
  Calendar,
  ArrowRight,
  Plus,
  MessageSquare,
  ImageIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type IssueStatus = 'submitted' | 'in_progress' | 'resolved';
type IssueSeverity = 'low' | 'medium' | 'high';
type IssueCategory = 'water_leak' | 'cleanliness' | 'furniture_damage' | 'electrical_issue' | 'others';

interface Issue {
  id: string;
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

const statusConfig: Record<IssueStatus, { label: string; class: string; icon: React.ReactNode; color: string }> = {
  submitted: { 
    label: 'Submitted', 
    class: 'status-badge-submitted',
    icon: <Clock className="h-3 w-3" />,
    color: 'bg-primary'
  },
  in_progress: { 
    label: 'In Progress', 
    class: 'status-badge-in-progress',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: 'bg-warning'
  },
  resolved: { 
    label: 'Resolved', 
    class: 'status-badge-resolved',
    icon: <CheckCircle className="h-3 w-3" />,
    color: 'bg-success'
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

    // Subscribe to realtime updates for this user's issues
    const channel = supabase
      .channel('my-issues-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'issues',
          filter: `student_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('Issue updated:', payload);
          setIssues((currentIssues) =>
            currentIssues.map((issue) =>
              issue.id === payload.new.id ? { ...issue, ...payload.new as Issue } : issue
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issues',
          filter: `student_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('New issue:', payload);
          setIssues((currentIssues) => [payload.new as Issue, ...currentIssues]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // Get status step index for progress bar
  const getStatusStep = (status: IssueStatus): number => {
    switch (status) {
      case 'submitted': return 1;
      case 'in_progress': return 2;
      case 'resolved': return 3;
      default: return 0;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Issues</h1>
            <p className="text-muted-foreground mt-1">
              Track the status of your reported issues in real-time
            </p>
          </div>
          <Button onClick={() => navigate('/report')} className="gap-2 shadow-md">
            <Plus className="h-4 w-4" />
            Report New Issue
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{counts.all}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{counts.submitted}</p>
              <p className="text-sm text-muted-foreground">Submitted</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/10 to-transparent border-warning/20">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-warning">{counts.in_progress}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-transparent border-success/20">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-success">{counts.resolved}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-muted/50 rounded-xl">
          {(['all', 'submitted', 'in_progress', 'resolved'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(status)}
              className={`gap-2 rounded-lg ${filter === status ? 'shadow-md' : ''}`}
            >
              {status === 'all' ? 'All' : statusConfig[status as IssueStatus].label}
              <Badge variant={filter === status ? 'secondary' : 'outline'} className="ml-1 text-xs">
                {counts[status]}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Issues List */}
        {loading ? (
          <Card className="shadow-lg">
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your issues...</p>
            </CardContent>
          </Card>
        ) : filteredIssues.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Issues Found</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                {filter === 'all' 
                  ? "You haven't reported any issues yet. Help us keep the campus clean!" 
                  : `No ${filter.replace('_', ' ')} issues.`}
              </p>
              {filter === 'all' && (
                <Button onClick={() => navigate('/report')} className="gap-2 shadow-md">
                  <Plus className="h-4 w-4" />
                  Report Your First Issue
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredIssues.map((issue) => {
              const statusStep = getStatusStep(issue.status);
              
              return (
                <Card key={issue.id} className="overflow-hidden hover:shadow-lg transition-all group">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Image */}
                      {issue.image_url && (
                        <div className="sm:w-52 h-36 sm:h-auto bg-muted shrink-0 overflow-hidden">
                          <img
                            src={issue.image_url}
                            alt="Issue"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                              {categoryLabels[issue.category]}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity}
                              </Badge>
                              <span className={`status-badge ${statusConfig[issue.status].class}`}>
                                {statusConfig[issue.status].icon}
                                <span className="ml-1">{statusConfig[issue.status].label}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                          {issue.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span>{issue.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Reported {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>

                        {issue.admin_comments && (
                          <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                            <div className="flex items-center gap-2 text-xs font-medium text-primary mb-1">
                              <MessageSquare className="h-3 w-3" />
                              Maintenance Response
                            </div>
                            <p className="text-sm">{issue.admin_comments}</p>
                          </div>
                        )}

                        {/* Show resolved image when status is resolved */}
                        {issue.status === 'resolved' && issue.resolved_image_url && (
                          <div className="mt-4 p-3 bg-[hsl(142,76%,36%,0.05)] rounded-xl border border-[hsl(142,76%,36%,0.2)]">
                            <div className="flex items-center gap-2 text-xs font-medium text-[hsl(142,76%,36%)] mb-2">
                              <ImageIcon className="h-3 w-3" />
                              Resolution Proof
                            </div>
                            <img
                              src={issue.resolved_image_url}
                              alt="Resolved issue proof"
                              className="w-full max-h-40 object-cover rounded-lg"
                            />
                          </div>
                        )}

                        {/* Status Progress - Blue color that fills based on status */}
                        <div className="mt-5">
                          <div className="flex items-center gap-1">
                            {/* Submitted */}
                            <div className="flex-1 relative">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    statusStep >= 1 ? 'bg-primary w-full' : 'w-0'
                                  }`} 
                                />
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            {/* In Progress */}
                            <div className="flex-1 relative">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    statusStep >= 2 ? 'bg-primary w-full' : 'w-0'
                                  }`} 
                                />
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            {/* Resolved */}
                            <div className="flex-1 relative">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    statusStep >= 3 ? 'bg-primary w-full' : 'w-0'
                                  }`} 
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                            <span className={statusStep >= 1 ? 'text-primary font-medium' : ''}>Submitted</span>
                            <span className={statusStep >= 2 ? 'text-primary font-medium' : ''}>In Progress</span>
                            <span className={statusStep >= 3 ? 'text-primary font-medium' : ''}>Resolved</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyIssues;
