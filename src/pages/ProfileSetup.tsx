import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, User, Mail, GraduationCap, Building, IdCard, Phone } from 'lucide-react';
import srmLogo from '@/assets/srm-logo.jpeg';

const departments = [
  'Computer Science and Engineering',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Information Technology',
  'Biomedical Engineering',
  'Chemical Engineering',
  'Biotechnology',
  'Other',
];

const degrees = [
  'B.Tech',
  'M.Tech',
  'B.Sc',
  'M.Sc',
  'BBA',
  'MBA',
  'B.Com',
  'M.Com',
  'PhD',
  'Other',
];

const ProfileSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    degree: '',
    department: '',
    registration_number: '',
    phone_number: '',
  });

  useEffect(() => {
    const checkExistingProfile = async () => {
      if (!user) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (profile?.profile_completed) {
          navigate('/dashboard');
          return;
        }

        // Pre-fill form with existing data
        setFormData({
          name: profile?.name || user.user_metadata?.name || '',
          email: user.email || '',
          degree: profile?.degree || '',
          department: profile?.department || '',
          registration_number: profile?.registration_number || profile?.student_id || '',
          phone_number: profile?.phone_number || '',
        });
      } catch (err) {
        console.error('Error checking profile:', err);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkExistingProfile();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.degree || !formData.department || !formData.registration_number || !formData.phone_number) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          degree: formData.degree,
          department: formData.department,
          registration_number: formData.registration_number,
          student_id: formData.registration_number,
          phone_number: formData.phone_number,
          profile_completed: true,
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success('Profile setup complete!');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <img src={srmLogo} alt="SRM Logo" className="h-20 w-auto mx-auto mb-4 rounded-full" />
          <h1 className="text-2xl font-bold text-primary">Complete Your Profile</h1>
          <p className="text-muted-foreground mt-2">This information helps us serve you better</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle>Profile Setup</CardTitle>
            <CardDescription>
              Please fill in your details. This is a one-time setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email ID</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    className="pl-10 bg-muted"
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              {/* Registration Number (read-only after first submission) */}
              <div className="space-y-2">
                <Label htmlFor="registration_number">Registration Number *</Label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="registration_number"
                    type="text"
                    placeholder="e.g., RA2011003010001"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Degree */}
              <div className="space-y-2">
                <Label htmlFor="degree">Degree *</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={formData.degree} onValueChange={(v) => setFormData({ ...formData, degree: v })}>
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Select your degree" />
                    </SelectTrigger>
                    <SelectContent>
                      {degrees.map((deg) => (
                        <SelectItem key={deg} value={deg}>{deg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone_number"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-lg font-semibold" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSetup;
