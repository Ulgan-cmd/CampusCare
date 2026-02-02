import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle,
  Send,
  Bot,
  XCircle,
  ShieldCheck,
  Droplets,
  Wind,
  Trash2,
  MapPin,
  Image as ImageIcon,
  FolderOpen,
  Building,
  Layers,
  DoorOpen,
  Clock,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';

type IssueCategory = 'air' | 'water' | 'waste';

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

// Subcategories for each main category
const categorySubcategories: Record<IssueCategory, string[]> = {
  air: ['Emission', 'Odour'],
  water: ['Leak', 'Stagnation', 'Quality', 'Drainage'],
  waste: ['Spillage'],
};

const categoryLabels: Record<IssueCategory, string> = {
  air: 'Air',
  water: 'Water',
  waste: 'Waste',
};

const categoryIcons: Record<IssueCategory, React.ReactNode> = {
  air: <Wind className="h-5 w-5" />,
  water: <Droplets className="h-5 w-5" />,
  waste: <Trash2 className="h-5 w-5" />,
};

// Map UI categories to database enum values
const categoryToDbEnum: Record<IssueCategory, string> = {
  air: 'air_emission',
  water: 'water',
  waste: 'others',
};

const urgencyOptions = [
  { value: 'can_wait', label: 'Can Wait', description: 'Minor issue, not affecting daily activities', icon: <Clock className="h-5 w-5" />, severity: 'low' as const },
  { value: 'needs_attention', label: 'Needs Attention', description: 'Should be fixed soon', icon: <AlertTriangle className="h-5 w-5" />, severity: 'medium' as const },
  { value: 'emergency', label: 'Emergency', description: 'Requires immediate action', icon: <AlertOctagon className="h-5 w-5" />, severity: 'high' as const },
];

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
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<
    'upload' | 'validating' | 'invalid' | 'location' | 'urgency' | 'submit' | 'success'
  >('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [category, setCategory] = useState<IssueCategory | ''>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);

  // Location fields
  const [buildingName, setBuildingName] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [roomArea, setRoomArea] = useState('');
  const [currentLocationField, setCurrentLocationField] = useState<'building' | 'floor' | 'room'>('building');

  // Urgency
  const [selectedUrgency, setSelectedUrgency] = useState('');

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

  // Check if user is inside campus
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
      const R = 6371e3;
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

  const proceedToLocation = async () => {
    if (!imageFile || !category) {
      toast.error('Please upload image and select category');
      return;
    }

    if (!selectedSubcategory) {
      toast.error('Please select a subcategory');
      return;
    }

    const isValid = await validateImage();
    if (!isValid) return;

    setStep('location');
    setCurrentLocationField('building');
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent, field: 'building' | 'floor' | 'room') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'building' && buildingName.trim()) {
        setCurrentLocationField('floor');
      } else if (field === 'floor' && floorNumber.trim()) {
        setCurrentLocationField('room');
      } else if (field === 'room' && roomArea.trim()) {
        setStep('urgency');
      }
    }
  };

  const proceedToUrgency = () => {
    if (!buildingName.trim() || !floorNumber.trim() || !roomArea.trim()) {
      toast.error('Please fill in all location fields');
      return;
    }
    setStep('urgency');
  };

  const proceedToSubmit = () => {
    if (!selectedUrgency) {
      toast.error('Please select urgency level');
      return;
    }
    setStep('submit');
  };

  const submitIssue = async () => {
    if (!user || !imageFile || !category) return;

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

      const fullLocation = `${buildingName}, Floor ${floorNumber}, ${roomArea}`;
      const description = `Category: ${categoryLabels[category]} - ${selectedSubcategory}. Location: ${fullLocation}. Urgency: ${selectedUrgency}`;

      // Map UI category to database enum value
      const dbCategory = categoryToDbEnum[category] as any;

      // Insert issue
      const { error: issueError } = await supabase.from('issues').insert({
        student_id: user.id,
        image_url: urlData.publicUrl,
        category: dbCategory,
        severity: selectedUrgency === 'emergency' ? 'high' : selectedUrgency === 'needs_attention' ? 'medium' : 'low',
        confidence: 100,
        location: fullLocation,
        description,
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
            severity: selectedUrgency,
            location: fullLocation,
            description,
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
    setSelectedSubcategory('');
    setBuildingName('');
    setFloorNumber('');
    setRoomArea('');
    setSelectedUrgency('');
    setValidationResult(null);
    setCurrentLocationField('building');
  };

  const getStepIndex = () => {
    const steps = ['upload', 'validating', 'location', 'urgency', 'submit', 'success'];
    return steps.indexOf(step === 'invalid' ? 'upload' : step);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Upload', 'Location', 'Urgency', 'Submit'].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    getStepIndex() > i
                      ? 'bg-primary text-primary-foreground'
                      : getStepIndex() === i || (step === 'validating' && i === 0)
                      ? 'bg-primary text-primary-foreground shadow-lg scale-110'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {getStepIndex() > i ? <CheckCircle className="h-5 w-5" /> : i + 1}
                </div>
                <span className="text-xs mt-1 text-muted-foreground">{label}</span>
              </div>
              {i < 3 && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    getStepIndex() > i ? 'bg-primary' : 'bg-muted'
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
                Upload a photo and select the issue category
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Upload Options */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Upload Image</Label>
                
                {imagePreview ? (
                  <div 
                    className="border-2 border-primary rounded-2xl p-4 bg-primary/5 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-xl shadow-lg"
                    />
                    <p className="text-sm text-muted-foreground text-center mt-3">Click to change image</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {/* Camera */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="p-6 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-2"
                    >
                      <Camera className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Camera</span>
                    </button>
                    
                    {/* Gallery */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-2"
                    >
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Gallery</span>
                    </button>
                    
                    {/* Files */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center gap-2"
                    >
                      <FolderOpen className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Files</span>
                    </button>
                  </div>
                )}
                
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Category Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Issue Category</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(categoryLabels) as IssueCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCategory(cat);
                        setSelectedSubcategory('');
                      }}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 ${
                        category === cat
                          ? 'border-primary bg-primary/10 shadow-md'
                          : 'border-border'
                      }`}
                    >
                      <div className={`${category === cat ? 'text-primary' : 'text-muted-foreground'}`}>
                        {categoryIcons[cat]}
                      </div>
                      <span className={`text-xs font-medium text-center ${category === cat ? 'text-primary' : ''}`}>
                        {categoryLabels[cat]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategory Selection */}
              {category && (
                <div className="space-y-3 animate-fade-in">
                  <Label className="text-base font-medium">Select Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {categorySubcategories[category].map((subcat) => (
                      <button
                        key={subcat}
                        type="button"
                        onClick={() => setSelectedSubcategory(subcat)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          selectedSubcategory === subcat
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary hover:bg-primary/5'
                        }`}
                      >
                        {subcat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={proceedToLocation}
                disabled={!imageFile || !category || !selectedSubcategory}
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

        {/* Location Step */}
        {step === 'location' && (
          <Card className="shadow-xl">
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Issue Location</CardTitle>
                  <CardDescription>Provide the exact location of the issue</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {/* Building Name */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  Building Name
                </Label>
                <Input
                  placeholder="e.g., Tech Park, Main Building, Hostel Block A"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  onKeyDown={(e) => handleLocationKeyDown(e, 'building')}
                  autoFocus={currentLocationField === 'building'}
                  className="h-12"
                />
              </div>

              {/* Floor Number */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Floor Number
                </Label>
                <Input
                  placeholder="e.g., Ground Floor, 1st Floor, 2nd Floor"
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(e.target.value)}
                  onKeyDown={(e) => handleLocationKeyDown(e, 'floor')}
                  autoFocus={currentLocationField === 'floor'}
                  className="h-12"
                />
              </div>

              {/* Room / Area */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-primary" />
                  Room / Area Description
                </Label>
                <Input
                  placeholder="e.g., Room 301, Near Elevator, Corridor, Washroom"
                  value={roomArea}
                  onChange={(e) => setRoomArea(e.target.value)}
                  onKeyDown={(e) => handleLocationKeyDown(e, 'room')}
                  autoFocus={currentLocationField === 'room'}
                  className="h-12"
                />
              </div>

              <Button
                onClick={proceedToUrgency}
                disabled={!buildingName.trim() || !floorNumber.trim() || !roomArea.trim()}
                className="w-full h-12 text-lg font-semibold shadow-lg"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Urgency Step */}
        {step === 'urgency' && (
          <Card className="shadow-xl">
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Select Urgency Level</CardTitle>
                  <CardDescription>How urgent is this issue?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {urgencyOptions.map((option) => {
                const isSelected = selectedUrgency === option.value;
                const colorClasses = {
                  low: isSelected ? 'border-[hsl(142,76%,36%)] bg-[hsl(142,76%,36%,0.1)] text-[hsl(142,76%,36%)]' : '',
                  medium: isSelected ? 'border-[hsl(38,92%,50%)] bg-[hsl(38,92%,50%,0.1)] text-[hsl(38,92%,50%)]' : '',
                  high: isSelected ? 'border-[hsl(0,84%,60%)] bg-[hsl(0,84%,60%,0.1)] text-[hsl(0,84%,60%)]' : '',
                };
                
                return (
                  <div
                    key={option.value}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedUrgency(option.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedUrgency(option.value); }}
                    className={`w-full p-5 rounded-xl border-2 transition-all flex items-center gap-4 text-left cursor-pointer select-none ${
                      isSelected
                        ? colorClasses[option.severity]
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${isSelected ? 'bg-white/50' : 'bg-muted'}`}>
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm opacity-80">{option.description}</p>
                    </div>
                  </div>
                );
              })}

              <Button
                onClick={proceedToSubmit}
                disabled={!selectedUrgency}
                className="w-full h-12 text-lg font-semibold shadow-lg mt-6"
              >
                Continue
              </Button>
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
                    <p className="font-medium">{category && categoryLabels[category]} - {selectedSubcategory}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Urgency</p>
                    <p className="font-medium capitalize">{selectedUrgency.replace('_', ' ')}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Location</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <p className="font-medium">{`${buildingName}, Floor ${floorNumber}, ${roomArea}`}</p>
                    </div>
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
