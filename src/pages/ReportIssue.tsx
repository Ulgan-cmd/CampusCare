import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Send,
  Bot,
  User as UserIcon,
  XCircle,
  ShieldCheck,
  Droplets,
  Sparkles,
  Armchair,
  Zap,
  HelpCircle,
  MapPin,
  Image as ImageIcon,
} from 'lucide-react';

type IssueCategory =
  | 'water_leak'
  | 'cleanliness'
  | 'furniture_damage'
  | 'electrical_issue'
  | 'others';

type IssueSeverity = 'low' | 'medium' | 'high';

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

interface ValidationResult {
  isValid: boolean;
  reason: string;
  confidence: number;
}

const categoryLabels: Record<IssueCategory, string> = {
  water_leak: 'Water Leak',
  cleanliness: 'Cleanliness',
  furniture_damage: 'Furniture Damage',
  electrical_issue: 'Electrical Issue',
  others: 'Others',
};

const categoryIcons: Record<IssueCategory, React.ReactNode> = {
  water_leak: <Droplets className="h-5 w-5" />,
  cleanliness: <Sparkles className="h-5 w-5" />,
  furniture_damage: <Armchair className="h-5 w-5" />,
  electrical_issue: <Zap className="h-5 w-5" />,
  others: <HelpCircle className="h-5 w-5" />,
};

const severityLabels: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// Clean AI text - remove asterisks and format properly
const cleanAIText = (text: string): string => {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-•]\s*/gm, '• ')
    .trim();
};

const ReportIssue = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<
    'upload' | 'validating' | 'invalid' | 'chat' | 'submit' | 'success'
  >('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [category, setCategory] = useState<IssueCategory | ''>('');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setValidationResult(null);
  };

  const validateImage = async (): Promise<boolean> => {
    if (!imagePreview) return false;

    setStep('validating');

    try {
      const { data, error } = await supabase.functions.invoke(
        'validate-image',
        {
          body: { imageBase64: imagePreview },
        }
      );

      if (error) {
        toast.error('Image validation failed');
        setStep('upload');
        return false;
      }

      setValidationResult(data);

      if (data.isValid) return true;

      setStep('invalid');
      return false;
    } catch {
      toast.error('Image validation service unavailable');
      setStep('upload');
      return false;
    }
  };

  // Check if user is inside campus using Radar.io
  const checkCampusLocation = async (): Promise<boolean> => {
    setCheckingLocation(true);
    
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          })
      );

      const { latitude, longitude } = position.coords;
      
      // SRM Campus center coordinates
      const CAMPUS_CENTER = { latitude: 12.823, longitude: 80.0444 };
      const MAX_DISTANCE = 1000; // 1km radius

      // Calculate distance using Haversine formula
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (latitude * Math.PI) / 180;
      const φ2 = (CAMPUS_CENTER.latitude * Math.PI) / 180;
      const Δφ = ((CAMPUS_CENTER.latitude - latitude) * Math.PI) / 180;
      const Δλ = ((CAMPUS_CENTER.longitude - longitude) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance > MAX_DISTANCE) {
        toast.error(
          `You must be inside the campus to submit an issue. You are ${Math.round(distance)}m from campus.`
        );
        return false;
      }

      return true;
    } catch (err) {
      toast.error('Unable to verify your location. Please enable GPS and try again.');
      return false;
    } finally {
      setCheckingLocation(false);
    }
  };

  const proceedToChat = async () => {
    if (!imageFile || !category || !severity) {
      toast.error('Please upload image and select category & severity');
      return;
    }

    const isValid = await validateImage();
    if (!isValid) return;

    setStep('chat');
    const cleanContent = cleanAIText(
      `You've selected ${categoryLabels[category]} with ${severity} severity.\n\nWhere exactly is this issue located? Please provide:\n• Building name\n• Floor number\n• Room or area description`
    );
    setChatMessages([
      {
        role: 'ai' as const,
        content: cleanContent,
      },
    ]);
  };

  const handleChatSubmit = () => {
    if (!userInput.trim()) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user' as const, content: userInput }];

    if (!location) {
      setLocation(userInput);
      const cleanContent = cleanAIText(
        'How urgent is this issue?\n\n• Can wait - Minor issue, not affecting daily activities\n• Needs attention - Should be fixed soon\n• Emergency - Requires immediate action'
      );
      newMessages.push({
        role: 'ai' as const,
        content: cleanContent,
      });
    } else if (!urgency) {
      setUrgency(userInput);
      const cleanContent = cleanAIText(
        'Thank you for providing the details.\n\nPlease review your report summary below and click Submit Issue when ready.'
      );
      newMessages.push({
        role: 'ai' as const,
        content: cleanContent,
      });
      setStep('submit');
    }

    setChatMessages(newMessages);
    setUserInput('');
  };

  const submitIssue = async () => {
    if (!user || !imageFile || !category || !severity) return;

    // First check if user is inside campus
    const insideCampus = await checkCampusLocation();
    if (!insideCampus) return;

    setSubmitting(true);

    try {
      const ext = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      await supabase.storage
        .from('issue-images')
        .upload(fileName, imageFile);

      const { data: urlData } = supabase.storage
        .from('issue-images')
        .getPublicUrl(fileName);

      // Insert issue
      const { error: issueError } = await supabase.from('issues').insert({
        student_id: user.id,
        image_url: urlData.publicUrl,
        category,
        severity,
        confidence: 100,
        location,
        description: `Location: ${location}. Urgency: ${urgency}`,
        status: 'submitted',
      });

      if (issueError) throw issueError;

      // Award 5 points for valid report
      await supabase.rpc('increment_points', { user_id: user.id, points_to_add: 5 });

      // Send email notification
      try {
        await supabase.functions.invoke('send-issue-notification', {
          body: {
            category: categoryLabels[category],
            severity,
            location,
            description: urgency,
            imageUrl: urlData.publicUrl,
            studentEmail: user.email,
          },
        });
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr);
      }

      setStep('success');
      toast.success('Issue submitted successfully! You earned 5 points.');
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to submit issue');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('upload');
    setImageFile(null);
    setImagePreview(null);
    setCategory('');
    setSeverity('');
    setChatMessages([]);
    setLocation('');
    setUrgency('');
    setValidationResult(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['upload', 'validating', 'chat', 'submit', 'success'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step === s
                    ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                    : ['upload', 'validating', 'chat', 'submit', 'success'].indexOf(step) > i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < 4 && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    ['upload', 'validating', 'chat', 'submit', 'success'].indexOf(step) > i
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <Card className="shadow-xl border-2">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Report an Issue</CardTitle>
              <CardDescription>
                Upload a photo and select the issue details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Upload */}
              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer hover:border-primary hover:bg-primary/5 ${
                  imagePreview ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="space-y-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-xl shadow-lg"
                    />
                    <p className="text-sm text-muted-foreground">Click to change image</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Click to upload or take photo</p>
                      <p className="text-sm text-muted-foreground">PNG, JPG up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Issue Category</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Object.keys(categoryLabels) as IssueCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 ${
                        category === cat
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border'
                      }`}
                    >
                      <div className={`${category === cat ? 'text-primary' : 'text-muted-foreground'}`}>
                        {categoryIcons[cat]}
                      </div>
                      <span className={`text-sm font-medium ${category === cat ? 'text-primary' : ''}`}>
                        {categoryLabels[cat]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Severity Level</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(['low', 'medium', 'high'] as IssueSeverity[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        severity === sev
                          ? sev === 'low'
                            ? 'border-success bg-success/10 text-success'
                            : sev === 'medium'
                            ? 'border-warning bg-warning/10 text-warning'
                            : 'border-destructive bg-destructive/10 text-destructive'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className="font-medium capitalize">{sev}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={proceedToChat}
                disabled={!imageFile || !category || !severity}
                className="w-full h-12 text-lg font-semibold shadow-lg"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Validating Step */}
        {step === 'validating' && (
          <Card className="shadow-xl">
            <CardContent className="py-16 text-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-2">Validating Image</h3>
              <p className="text-muted-foreground">
                Checking if the image shows a valid campus issue...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Invalid Image Step */}
        {step === 'invalid' && (
          <Card className="shadow-xl border-destructive/50">
            <CardContent className="py-12 text-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-destructive">Invalid Image</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {validationResult?.reason || 'This image does not appear to show a valid campus infrastructure issue.'}
              </p>
              <Button onClick={resetForm} variant="outline">
                Try Another Image
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Chat Step */}
        {step === 'chat' && (
          <Card className="shadow-xl">
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Issue Details</CardTitle>
                  <CardDescription>Tell us more about the issue</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Chat Messages */}
              <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      <p className="whitespace-pre-line text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-3">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="Type your response..."
                  className="h-12"
                />
                <Button onClick={handleChatSubmit} size="icon" className="h-12 w-12 shrink-0">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Step */}
        {step === 'submit' && (
          <Card className="shadow-xl">
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success text-success-foreground">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Review & Submit</CardTitle>
                  <CardDescription>Confirm your issue report</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Summary */}
              <div className="grid gap-4">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Issue"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="font-medium">{category && categoryLabels[category]}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Severity</p>
                    <Badge className={
                      severity === 'low' ? 'severity-badge-low' :
                      severity === 'medium' ? 'severity-badge-medium' : 'severity-badge-high'
                    }>
                      {severity}
                    </Badge>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Location</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <p className="font-medium">{location}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Urgency</p>
                    <p className="font-medium">{urgency}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm">
                  Your location will be verified to ensure you're on campus before submission.
                </p>
              </div>

              <Button
                onClick={submitIssue}
                disabled={submitting || checkingLocation}
                className="w-full h-14 text-lg font-semibold shadow-lg"
              >
                {checkingLocation ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying Location...
                  </>
                ) : submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Submit Issue
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <Card className="shadow-xl">
            <CardContent className="py-12 text-center">
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Issue Submitted!</h3>
              <p className="text-muted-foreground mb-2">
                Your report has been sent to the maintenance team.
              </p>
              <p className="text-success font-medium mb-6">
                +5 points earned for your valid report!
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={resetForm} variant="outline">
                  Report Another Issue
                </Button>
                <Button onClick={() => navigate('/my-issues')}>
                  View My Issues
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ReportIssue;
