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
} from 'lucide-react';

type IssueCategory = 'water_leak' | 'cleanliness' | 'furniture_damage' | 'electrical_issue' | 'others';
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

const ReportIssue = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'validating' | 'invalid' | 'chat' | 'submit' | 'success'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [category, setCategory] = useState<IssueCategory | ''>('');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setValidationResult(null);
    }
  };

  const validateImage = async (): Promise<boolean> => {
    if (!imagePreview) return false;

    setStep('validating');

    try {
      const { data, error } = await supabase.functions.invoke('validate-image', {
        body: { imageBase64: imagePreview },
      });

      if (error) {
        console.error('Validation error:', error);
        toast.error('Image validation failed. Please try again.');
        setStep('upload');
        return false;
      }

      setValidationResult(data);

      if (data.isValid) {
        return true;
      } else {
        setStep('invalid');
        return false;
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast.error('Image validation service unavailable');
      setStep('upload');
      return false;
    }
  };

  const proceedToChat = async () => {
    if (!imageFile || !category || !severity) {
      toast.error('Please upload an image and select category and severity');
      return;
    }

    // Validate image before proceeding
    const isValid = await validateImage();
    
    if (!isValid) return;

    setStep('chat');
    setChatMessages([
      {
        role: 'ai',
        content: `You've selected **${categoryLabels[category]}** with **${severity}** severity.\n\nTo complete your report, please answer a few questions:\n\n**Where exactly is this issue located?** (e.g., Building A, Room 101)`,
      },
    ]);
  };

  const handleChatSubmit = () => {
    if (!userInput.trim()) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userInput }];

    if (!location) {
      setLocation(userInput);
      newMessages.push({
        role: 'ai',
        content: `Got it! Location noted as "${userInput}".\n\n**How urgent is this issue?** (e.g., Can wait, Needs attention soon, Emergency)`,
      });
    } else if (!urgency) {
      setUrgency(userInput);
      newMessages.push({
        role: 'ai',
        content: `Thank you! I've gathered all the information needed.\n\n**Summary:**\n- **Category:** ${category ? categoryLabels[category] : 'Unknown'}\n- **Severity:** ${severity}\n- **Location:** ${location}\n- **Urgency:** ${userInput}\n\nPlease review and click "Submit Issue" when ready.`,
      });
      setStep('submit');
    }

    setChatMessages(newMessages);
    setUserInput('');
  };

  const submitIssue = async () => {
    if (!user || !imageFile || !category || !severity) return;

    setSubmitting(true);

    try {
      // Upload image to storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('issue-images')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('issue-images')
        .getPublicUrl(fileName);

      // Create issue in database
      const { data: issueData, error: issueError } = await supabase.from('issues').insert({
        student_id: user.id,
        image_url: urlData.publicUrl,
        category: category,
        severity: severity,
        confidence: 100, // Manual selection = 100% confidence
        location: location,
        description: `Category: ${categoryLabels[category]}. Location: ${location}. Urgency: ${urgency}.`,
        status: 'submitted',
      }).select().single();

      if (issueError) throw issueError;

      // Send email notification via edge function
      try {
        const { error: emailError } = await supabase.functions.invoke('send-issue-notification', {
          body: {
            issueId: issueData.id,
            category: categoryLabels[category],
            severity: severity,
            location: location,
            urgency: urgency,
            imageUrl: urlData.publicUrl,
            studentEmail: user.email,
          },
        });

        if (emailError) {
          console.error('Email notification failed:', emailError);
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
      }

      setStep('success');
      toast.success('Issue submitted successfully!');

    } catch (err) {
      console.error('Error submitting issue:', err);
      toast.error('Failed to submit issue. Please try again.');
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

  const getSeverityColor = (sev: IssueSeverity) => {
    switch (sev) {
      case 'low': return 'severity-badge-low';
      case 'medium': return 'severity-badge-medium';
      case 'high': return 'severity-badge-high';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Report an Issue</h1>
          <p className="text-muted-foreground mt-2">
            Upload an image and select the issue category to report campus issues
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between text-sm bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className={`flex items-center gap-2 ${!['upload', 'validating', 'invalid'].includes(step) ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${!['upload', 'validating', 'invalid'].includes(step) ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted'}`}>
              {!['upload', 'validating', 'invalid'].includes(step) ? <CheckCircle className="h-5 w-5" /> : '1'}
            </div>
            <span className="hidden sm:block font-medium">Upload & Select</span>
          </div>
          <div className="flex-1 h-1 bg-muted mx-3 rounded-full overflow-hidden">
            <div className={`h-full bg-primary transition-all duration-500 ${['chat', 'submit', 'success'].includes(step) ? 'w-full' : 'w-0'}`} />
          </div>
          <div className={`flex items-center gap-2 ${['chat', 'submit', 'success'].includes(step) ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${['submit', 'success'].includes(step) ? 'bg-primary text-primary-foreground shadow-md' : ['chat'].includes(step) ? 'bg-primary/20 text-primary' : 'bg-muted'}`}>
              {['submit', 'success'].includes(step) ? <CheckCircle className="h-5 w-5" /> : '2'}
            </div>
            <span className="hidden sm:block font-medium">Details</span>
          </div>
          <div className="flex-1 h-1 bg-muted mx-3 rounded-full overflow-hidden">
            <div className={`h-full bg-primary transition-all duration-500 ${step === 'success' ? 'w-full' : 'w-0'}`} />
          </div>
          <div className={`flex items-center gap-2 ${step === 'success' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${step === 'success' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted'}`}>
              {step === 'success' ? <CheckCircle className="h-5 w-5" /> : '3'}
            </div>
            <span className="hidden sm:block font-medium">Submit</span>
          </div>
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-all">
            <CardHeader className="text-center pb-2">
              <CardTitle className="flex items-center justify-center gap-2 text-xl">
                <Camera className="h-6 w-6 text-primary" />
                Upload Issue Image
              </CardTitle>
              <CardDescription>
                Take a photo or upload an existing image of the issue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className="relative border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all group"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="space-y-4">
                    <div className="relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-64 mx-auto rounded-xl shadow-lg"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <p className="text-white font-medium">Click to change</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <Upload className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground">PNG, JPG up to 10MB</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Category Selection - Card Grid */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Issue Category</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Object.keys(categoryLabels) as IssueCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        category === cat
                          ? 'border-primary bg-primary/5 text-primary shadow-md'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {categoryIcons[cat]}
                      </div>
                      <span className="text-sm font-medium">{categoryLabels[cat]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Selection - Visual Cards */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Severity Level</Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'low', label: 'Low', description: 'Can wait', color: 'text-green-600 bg-green-50 border-green-200' },
                    { value: 'medium', label: 'Medium', description: 'Soon', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                    { value: 'high', label: 'High', description: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200' },
                  ].map((sev) => (
                    <button
                      key={sev.value}
                      type="button"
                      onClick={() => setSeverity(sev.value as IssueSeverity)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        severity === sev.value
                          ? `${sev.color} shadow-md`
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-semibold">{sev.label}</p>
                      <p className="text-xs text-muted-foreground">{sev.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {imageFile && category && severity && (
                <Button onClick={proceedToChat} className="w-full h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow">
                  Continue to Details
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validating Step */}
        {step === 'validating' && (
          <Card className="border-primary/20">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Validating Image</h2>
              <p className="text-muted-foreground mb-6">
                Checking if the image shows a valid campus issue...
              </p>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            </CardContent>
          </Card>
        )}

        {/* Invalid Image Step */}
        {step === 'invalid' && validationResult && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-12 text-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Invalid Image</h2>
              <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                {validationResult.reason}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Please upload an image showing a valid campus infrastructure issue.
              </p>
              <Button onClick={resetForm} variant="outline" className="gap-2">
                <Camera className="h-4 w-4" />
                Upload Different Image
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Chat & Submit Steps */}
        {['chat', 'submit'].includes(step) && (
          <>
            {/* Selected Options Summary */}
            {category && severity && (
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Issue"
                          className="w-16 h-16 rounded-xl object-cover shadow-md"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
                            {categoryIcons[category]}
                          </div>
                          <h3 className="font-semibold text-lg">{categoryLabels[category]}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getSeverityColor(severity)}>
                            {severity} severity
                          </Badge>
                          {validationResult && (
                            <Badge variant="secondary" className="gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chat Interface */}
            <Card className="shadow-lg">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                    <Bot className="h-5 w-5" />
                  </div>
                  Issue Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-4 max-h-[400px] overflow-y-auto p-2">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                        msg.role === 'ai' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        {msg.role === 'ai' ? <Bot className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                      </div>
                      <div className={`rounded-2xl px-4 py-3 max-w-[80%] shadow-sm ${
                        msg.role === 'ai' ? 'bg-muted' : 'bg-primary text-primary-foreground'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {step === 'chat' && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Input
                      placeholder="Type your response..."
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                      className="h-12"
                    />
                    <Button onClick={handleChatSubmit} disabled={!userInput.trim()} size="lg" className="px-6">
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                )}

                {step === 'submit' && (
                  <Button onClick={submitIssue} className="w-full h-12 text-lg font-semibold shadow-lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Submit Issue
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">Issue Submitted!</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Your issue has been submitted successfully and sent to the maintenance department for review.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button variant="outline" onClick={() => navigate('/my-issues')} size="lg" className="shadow-sm">
                  View My Issues
                </Button>
                <Button onClick={resetForm} size="lg" className="shadow-lg">
                  Report Another Issue
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
