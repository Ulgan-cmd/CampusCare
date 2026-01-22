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
} from 'lucide-react';

type IssueCategory = 'water_leak' | 'cleanliness' | 'furniture_damage' | 'electrical_issue' | 'others';
type IssueSeverity = 'low' | 'medium' | 'high';

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

const categoryLabels: Record<IssueCategory, string> = {
  water_leak: 'Water Leak',
  cleanliness: 'Cleanliness',
  furniture_damage: 'Furniture Damage',
  electrical_issue: 'Electrical Issue',
  others: 'Others',
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

  const [step, setStep] = useState<'upload' | 'chat' | 'submit' | 'success'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [category, setCategory] = useState<IssueCategory | ''>('');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const proceedToChat = () => {
    if (!imageFile || !category || !severity) {
      toast.error('Please upload an image and select category and severity');
      return;
    }

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
          // Don't throw - issue is still submitted successfully
        }
      } catch (emailErr) {
        console.error('Email notification error:', emailErr);
        // Don't throw - issue is still submitted successfully
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report an Issue</h1>
          <p className="text-muted-foreground mt-1">
            Upload an image and select the issue category to report campus issues.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between text-sm">
          <div className={`flex items-center gap-2 ${step !== 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step !== 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {step !== 'upload' ? <CheckCircle className="h-4 w-4" /> : '1'}
            </div>
            <span>Upload & Select</span>
          </div>
          <div className="flex-1 h-0.5 bg-muted mx-2" />
          <div className={`flex items-center gap-2 ${['chat', 'submit', 'success'].includes(step) ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${['chat', 'submit', 'success'].includes(step) ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {['submit', 'success'].includes(step) ? <CheckCircle className="h-4 w-4" /> : '2'}
            </div>
            <span>Details</span>
          </div>
          <div className="flex-1 h-0.5 bg-muted mx-2" />
          <div className={`flex items-center gap-2 ${step === 'success' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'success' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {step === 'success' ? <CheckCircle className="h-4 w-4" /> : '3'}
            </div>
            <span>Submit</span>
          </div>
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Issue Image & Select Category
              </CardTitle>
              <CardDescription>
                Take a photo or upload an existing image and select the issue type.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="space-y-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg shadow-sm"
                    />
                    <p className="text-sm text-muted-foreground">Click to change image</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Camera className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Click to upload or drag and drop</p>
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

              {/* Category Selection */}
              <div className="space-y-2">
                <Label htmlFor="category">Issue Category</Label>
                <Select value={category} onValueChange={(val) => setCategory(val as IssueCategory)}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select issue category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="water_leak">Water Leak</SelectItem>
                    <SelectItem value="cleanliness">Cleanliness</SelectItem>
                    <SelectItem value="furniture_damage">Furniture Damage</SelectItem>
                    <SelectItem value="electrical_issue">Electrical Issue</SelectItem>
                    <SelectItem value="others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Severity Selection */}
              <div className="space-y-2">
                <Label htmlFor="severity">Severity Level</Label>
                <Select value={severity} onValueChange={(val) => setSeverity(val as IssueSeverity)}>
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Can wait</SelectItem>
                    <SelectItem value="medium">Medium - Needs attention soon</SelectItem>
                    <SelectItem value="high">High - Urgent / Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {imageFile && category && severity && (
                <Button onClick={proceedToChat} className="w-full">
                  Continue to Details
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Chat & Submit Steps */}
        {['chat', 'submit'].includes(step) && (
          <>
            {/* Selected Options */}
            {category && severity && (
              <Card className="border-primary/20">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Issue"
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{categoryLabels[category]}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getSeverityColor(severity)}>
                            {severity}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <AlertTriangle className={`h-6 w-6 ${
                      severity === 'high' ? 'text-destructive' :
                      severity === 'medium' ? 'text-warning' : 'text-success'
                    }`} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chat Interface */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-primary" />
                  Issue Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'ai' ? 'bg-primary/10 text-primary' : 'bg-muted'
                      }`}>
                        {msg.role === 'ai' ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                      </div>
                      <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                        msg.role === 'ai' ? 'bg-muted' : 'bg-primary text-primary-foreground'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {step === 'chat' && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your response..."
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                    />
                    <Button onClick={handleChatSubmit} disabled={!userInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {step === 'submit' && (
                  <Button onClick={submitIssue} className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
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
          <Card className="border-success/30 bg-success/5">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Issue Submitted!</h2>
              <p className="text-muted-foreground mb-6">
                Your issue has been submitted successfully and sent to the maintenance department.
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => navigate('/my-issues')}>
                  View My Issues
                </Button>
                <Button onClick={() => {
                  setStep('upload');
                  setImageFile(null);
                  setImagePreview(null);
                  setCategory('');
                  setSeverity('');
                  setChatMessages([]);
                  setLocation('');
                  setUrgency('');
                }}>
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
