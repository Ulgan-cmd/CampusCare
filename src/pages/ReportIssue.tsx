import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

  const proceedToChat = async () => {
    if (!imageFile || !category || !severity) {
      toast.error('Please upload image and select category & severity');
      return;
    }

    const isValid = await validateImage();
    if (!isValid) return;

    setStep('chat');
    setChatMessages([
      {
        role: 'ai',
        content: `You've selected **${categoryLabels[category]}** with **${severity}** severity.\n\nWhere exactly is this issue located?`,
      },
    ]);
  };

  const handleChatSubmit = () => {
    if (!userInput.trim()) return;

    const newMessages = [...chatMessages, { role: 'user', content: userInput }];

    if (!location) {
      setLocation(userInput);
      newMessages.push({
        role: 'ai',
        content:
          'How urgent is this issue? (Can wait / Needs attention / Emergency)',
      });
    } else if (!urgency) {
      setUrgency(userInput);
      newMessages.push({
        role: 'ai',
        content:
          'Review the details and click **Submit Issue** when ready.',
      });
      setStep('submit');
    }

    setChatMessages(newMessages);
    setUserInput('');
  };

  // 🔒 FINAL SUBMISSION WITH CAMPUS CHECK
  const submitIssue = async () => {
    if (!user || !imageFile || !category || !severity) return;

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
      );

      const res = await fetch('/api/check-campus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });

      const data = await res.json();

      if (!data.insideCampus) {
        toast.error(
          'You must be inside the campus to submit an issue.'
        );
        return;
      }
    } catch {
      toast.error('Location verification failed');
      return;
    }

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

      await supabase.from('issues').insert({
        student_id: user.id,
        image_url: urlData.publicUrl,
        category,
        severity,
        confidence: 100,
        location,
        description: `Location: ${location}. Urgency: ${urgency}`,
        status: 'submitted',
      });

      setStep('success');
      toast.success('Issue submitted successfully!');
    } catch {
      toast.error('Failed to submit issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Issue Image</CardTitle>
              <CardDescription>
                Take or upload a photo of the issue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
              />
              {imageFile && category && severity && (
                <Button onClick={proceedToChat} className="mt-4">
                  Continue
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'chat' && (
          <Card>
            <CardContent>
              {chatMessages.map((m, i) => (
                <p key={i}>
                  <b>{m.role}:</b> {m.content}
                </p>
              ))}
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
              />
            </CardContent>
          </Card>
        )}

        {step === 'submit' && (
          <Button onClick={submitIssue} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Issue'}
          </Button>
        )}

        {step === 'success' && (
          <Card>
            <CardContent className="text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
              <p className="mt-4">Issue submitted successfully</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ReportIssue;
