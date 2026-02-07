import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, Lock } from 'lucide-react';
import srmLogo from '@/assets/srm-logo.jpeg';

const ALLOWED_EMAIL_DOMAIN = '@srmist.edu.in';

const validateEmailDomain = (email: string): boolean => {
  return email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
};

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const checkProfileAndRedirect = async (userId: string, userEmail: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', userId)
      .single();

    if (userEmail === 'vt9575@srmist.edu.in') {
      navigate('/maintenance/incoming');
    } else if (profile?.profile_completed) {
      navigate('/dashboard');
    } else {
      navigate('/profile-setup');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!validateEmailDomain(email)) {
      setEmailError('Only @srmist.edu.in emails are allowed');
      toast.error('Only @srmist.edu.in emails are allowed');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Logged in successfully!');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await checkProfileAndRedirect(user.id, user.email || '');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <img src={srmLogo} alt="SRM Logo" className="h-20 w-auto mx-auto mb-4 rounded-full" />
          <h1 className="text-2xl font-bold text-primary">Campus Care</h1>
        </div>

        <Card className="border-border shadow-xl">
          <form onSubmit={handleSignIn}>
            <CardHeader className="pb-4">
              <CardTitle className="text-center text-lg">Log In</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="yourname@srmist.edu.in"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError('');
                    }}
                    className={`pl-10 ${emailError ? 'border-destructive' : ''}`}
                    required
                  />
                </div>
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Log In'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
