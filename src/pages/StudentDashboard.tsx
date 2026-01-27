import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Plus, 
  Trophy, 
  TrendingUp,
  FileText,
  Camera,
  ArrowRight,
  Download,
  Award,
} from 'lucide-react';

// Import badge images
import badgeBronze from '@/assets/badge-bronze.jpeg';
import badgeSilver from '@/assets/badge-silver.jpeg';
import badgeGold from '@/assets/badge-gold.jpeg';

interface Stats {
  submitted: number;
  resolved: number;
  points: number;
}

interface BadgeInfo {
  name: string;
  tier: 'bronze' | 'silver' | 'gold';
  image: string;
  minPoints: number;
  color: string;
}

const getBadgeForPoints = (points: number): BadgeInfo | null => {
  if (points >= 1000) {
    return {
      name: 'Elite',
      tier: 'gold',
      image: badgeGold,
      minPoints: 1000,
      color: 'from-yellow-500 to-yellow-600',
    };
  } else if (points >= 500) {
    return {
      name: 'Prime',
      tier: 'silver',
      image: badgeSilver,
      minPoints: 500,
      color: 'from-gray-400 to-gray-500',
    };
  } else if (points >= 200) {
    return {
      name: 'Verified',
      tier: 'bronze',
      image: badgeBronze,
      minPoints: 200,
      color: 'from-orange-600 to-orange-700',
    };
  }
  return null;
};

const getNextBadge = (points: number): { name: string; pointsNeeded: number } | null => {
  if (points < 200) {
    return { name: 'Verified (Bronze)', pointsNeeded: 200 - points };
  } else if (points < 500) {
    return { name: 'Prime (Silver)', pointsNeeded: 500 - points };
  } else if (points < 1000) {
    return { name: 'Elite (Gold)', pointsNeeded: 1000 - points };
  }
  return null;
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ submitted: 0, resolved: 0, points: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        // Fetch issues count
        const { data: issues, error: issuesError } = await supabase
          .from('issues')
          .select('status')
          .eq('student_id', user.id);

        if (issuesError) throw issuesError;

        const submitted = issues?.length || 0;
        const resolved = issues?.filter(i => i.status === 'resolved').length || 0;

        // Fetch profile for points
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') throw profileError;

        setStats({
          submitted,
          resolved,
          points: profile?.points || 0,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Student';
  const currentBadge = getBadgeForPoints(stats.points);
  const nextBadge = getNextBadge(stats.points);

  const handleDownloadBadge = () => {
    if (currentBadge) {
      const link = document.createElement('a');
      link.href = currentBadge.image;
      link.download = `CampusCare_${currentBadge.name}_Badge.jpeg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-8 text-primary-foreground shadow-xl">
          <div className="absolute inset-0 bg-[url('/placeholder.svg')] opacity-5" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <p className="text-primary-foreground/80 text-sm font-medium mb-1">Welcome back,</p>
              <h1 className="text-3xl font-bold">
                {userName}
              </h1>
              <p className="text-primary-foreground/80 mt-2 max-w-md">
                Help keep our campus in great condition by reporting issues. Every report makes a difference!
              </p>
            </div>
            <Button 
              size="lg" 
              onClick={() => navigate('/report')} 
              className="gap-2 bg-white text-primary hover:bg-white/90 shadow-lg font-semibold"
            >
              <Plus className="h-5 w-5" />
              Report an Issue
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border hover:shadow-lg transition-shadow group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues Submitted</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <FileText className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? '-' : stats.submitted}</div>
              <p className="text-xs text-muted-foreground mt-1">Total reports filed</p>
            </CardContent>
          </Card>

          <Card className="border-border hover:shadow-lg transition-shadow group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues Resolved</CardTitle>
              <div className="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{loading ? '-' : stats.resolved}</div>
              <p className="text-xs text-muted-foreground mt-1">Successfully fixed</p>
            </CardContent>
          </Card>

          <Card className="border-border hover:shadow-lg transition-shadow group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Earned</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors">
                <Trophy className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{loading ? '-' : stats.points}</div>
              <p className="text-xs text-muted-foreground mt-1">Valid report: 5 pts • Resolved: 50 pts</p>
            </CardContent>
          </Card>
        </div>

        {/* Badge Section */}
        <Card className="border-border shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
            <div className="flex items-center gap-3">
              <Award className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Your Badge Status</CardTitle>
                <CardDescription>Earn badges by accumulating points through reporting</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {currentBadge ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${currentBadge.color} rounded-full blur-xl opacity-30`} />
                  <img 
                    src={currentBadge.image} 
                    alt={`${currentBadge.name} Badge`}
                    className="relative w-32 h-32 object-cover rounded-full border-4 border-background shadow-xl"
                  />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold">{currentBadge.name} Badge</h3>
                  <p className="text-muted-foreground mt-1">
                    Congratulations! You've earned the {currentBadge.tier} tier badge.
                  </p>
                  {nextBadge && (
                    <p className="text-sm text-primary mt-2">
                      <TrendingUp className="inline h-4 w-4 mr-1" />
                      {nextBadge.pointsNeeded} more points to unlock {nextBadge.name}
                    </p>
                  )}
                  <Button 
                    onClick={handleDownloadBadge} 
                    className="mt-4 gap-2"
                    variant="outline"
                  >
                    <Download className="h-4 w-4" />
                    Download Badge
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="flex justify-center gap-4 mb-6">
                  <div className="opacity-40">
                    <img src={badgeBronze} alt="Bronze Badge" className="w-20 h-20 object-cover rounded-full grayscale" />
                    <p className="text-xs mt-2">200 pts</p>
                  </div>
                  <div className="opacity-40">
                    <img src={badgeSilver} alt="Silver Badge" className="w-20 h-20 object-cover rounded-full grayscale" />
                    <p className="text-xs mt-2">500 pts</p>
                  </div>
                  <div className="opacity-40">
                    <img src={badgeGold} alt="Gold Badge" className="w-20 h-20 object-cover rounded-full grayscale" />
                    <p className="text-xs mt-2">1000 pts</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Keep reporting issues to earn your first badge!
                </p>
                {nextBadge && (
                  <p className="text-sm text-primary mt-2">
                    <TrendingUp className="inline h-4 w-4 mr-1" />
                    {nextBadge.pointsNeeded} more points to unlock {nextBadge.name}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent hover:shadow-lg transition-all group cursor-pointer" onClick={() => navigate('/report')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary text-primary-foreground shadow-md group-hover:scale-110 transition-transform">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Report a New Issue
                  </CardTitle>
                  <CardDescription>
                    Upload an image and select the category
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full gap-2 shadow-md">
                <Plus className="h-4 w-4" />
                Start Reporting
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border hover:shadow-lg transition-all group cursor-pointer" onClick={() => navigate('/my-issues')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <Clock className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Track Your Issues
                  </CardTitle>
                  <CardDescription>
                    View status and resolution progress
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full gap-2">
                <TrendingUp className="h-4 w-4" />
                View My Issues
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">How It Works</CardTitle>
            <CardDescription>Simple 3-step process to report campus issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                  1
                </div>
                <h3 className="font-semibold text-lg mb-2">Upload Image</h3>
                <p className="text-sm text-muted-foreground">
                  Take or upload a photo of the issue you want to report
                </p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                  2
                </div>
                <h3 className="font-semibold text-lg mb-2">Select Category</h3>
                <p className="text-sm text-muted-foreground">
                  Choose the issue type and severity level
                </p>
              </div>
              <div className="text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                  3
                </div>
                <h3 className="font-semibold text-lg mb-2">Submit & Track</h3>
                <p className="text-sm text-muted-foreground">
                  Submit the report and track its status until resolved
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
