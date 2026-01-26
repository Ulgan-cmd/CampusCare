import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  Loader2,
  MapPin,
  Calendar,
  FolderOpen
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DownloadedReport {
  id: string;
  user_id: string;
  issue_id: string;
  issue_category: string;
  location: string | null;
  issue_status: string;
  downloaded_at: string;
  file_url: string;
  file_name: string;
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

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'resolved': return 'bg-[hsl(142,76%,36%)] text-white';
    case 'in_progress': return 'bg-[hsl(38,92%,50%)] text-white';
    default: return 'bg-primary text-primary-foreground';
  }
};

const MyWorks = () => {
  const { user, role } = useAuth();
  const [reports, setReports] = useState<DownloadedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      if (!user) return;

      try {
        let query = supabase
          .from('downloaded_reports')
          .select('*')
          .order('downloaded_at', { ascending: false });

        // Students only see their own reports, maintenance sees all
        if (role !== 'maintenance') {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) throw error;
        setReports(data || []);
      } catch (err) {
        console.error('Error fetching reports:', err);
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [user, role]);

  const handleViewPDF = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const handleDownloadPDF = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Failed to download PDF');
    }
  };

  const handleDeleteReport = async (report: DownloadedReport) => {
    // Only allow deletion of own reports
    if (report.user_id !== user?.id) {
      toast.error('You can only delete your own reports');
      return;
    }

    setDeleting(report.id);

    try {
      // Extract file path from URL for storage deletion
      const urlParts = report.file_url.split('/');
      const bucketIndex = urlParts.findIndex(p => p === 'issue-reports');
      if (bucketIndex !== -1) {
        const filePath = urlParts.slice(bucketIndex + 1).join('/');
        await supabase.storage.from('issue-reports').remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('downloaded_reports')
        .delete()
        .eq('id', report.id);

      if (error) throw error;

      setReports(prev => prev.filter(r => r.id !== report.id));
      toast.success('Report deleted successfully');
    } catch (err) {
      console.error('Error deleting report:', err);
      toast.error('Failed to delete report');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Works</h1>
          <p className="text-muted-foreground mt-1">
            {role === 'maintenance' 
              ? 'View all downloaded issue reports' 
              : 'Your downloaded issue reports'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{reports.length}</p>
              <p className="text-sm text-muted-foreground">Total Reports</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[hsl(142,76%,36%,0.1)] to-transparent border-[hsl(142,76%,36%,0.2)]">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-[hsl(142,76%,36%)]">
                {reports.filter(r => r.issue_status === 'resolved').length}
              </p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[hsl(38,92%,50%,0.1)] to-transparent border-[hsl(38,92%,50%,0.2)]">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-[hsl(38,92%,50%)]">
                {reports.filter(r => r.issue_status === 'in_progress').length}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-muted to-transparent border-muted-foreground/20">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-muted-foreground">
                {reports.filter(r => r.issue_status === 'submitted').length}
              </p>
              <p className="text-sm text-muted-foreground">Submitted</p>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        {loading ? (
          <Card className="shadow-lg">
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading your reports...</p>
            </CardContent>
          </Card>
        ) : reports.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Reports Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Downloaded issue reports will appear here. Generate a report from any issue to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-all group">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Icon Section */}
                    <div className="sm:w-24 h-20 sm:h-auto bg-primary/5 flex items-center justify-center shrink-0">
                      <FileText className="h-10 w-10 text-primary" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {categoryLabels[report.issue_category] || report.issue_category}
                          </h3>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge className={getStatusBadgeClass(report.issue_status)}>
                              {report.issue_status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewPDF(report.file_url)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDownloadPDF(report.file_url, report.file_name)}
                            className="gap-1"
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                          {report.user_id === user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="gap-1 text-destructive hover:text-destructive"
                                  disabled={deleting === report.id}
                                >
                                  {deleting === report.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Report</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this report? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteReport(report)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        {report.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span>{report.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Downloaded {formatDistanceToNow(new Date(report.downloaded_at), { addSuffix: true })}
                            {' • '}
                            {format(new Date(report.downloaded_at), 'PPp')}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {report.file_name}
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

export default MyWorks;