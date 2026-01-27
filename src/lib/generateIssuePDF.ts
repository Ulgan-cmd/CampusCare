import jsPDF from 'jspdf';
import { format } from 'date-fns';
import srmLogo from '@/assets/srm-logo-new.png';

interface StudentDetails {
  name: string | null;
  registration_number: string | null;
  degree: string | null;
  department: string | null;
  email: string;
  phone_number: string | null;
}

interface IssueDetails {
  id: string;
  category: string;
  description: string | null;
  severity: string;
  created_at: string;
  location: string | null;
  status: string;
  updated_at: string;
  image_url: string | null;
  resolved_image_url: string | null;
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

const severityLabels: Record<string, string> = {
  low: 'Can Wait',
  medium: 'Needs Attention',
  high: 'Emergency',
};

// Parse location string into structured parts
const parseLocation = (location: string | null): { building: string; floor: string; room: string } => {
  if (!location) return { building: '', floor: '', room: '' };
  
  const parts = location.split(',').map(p => p.trim());
  return {
    building: parts[0] || '',
    floor: parts[1] || '',
    room: parts[2] || '',
  };
};

// Load image as base64
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
};

// Load local asset as base64
const loadAssetAsBase64 = async (assetPath: string): Promise<string | null> => {
  try {
    const response = await fetch(assetPath);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading asset:', error);
    return null;
  }
};

export const generateIssuePDF = async (
  student: StudentDetails,
  issue: IssueDetails
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  
  // Colors matching template
  const textColor: [number, number, number] = [0, 0, 0];
  const grayText: [number, number, number] = [100, 100, 100];
  
  let yPos = margin;

  // Load SRM logo
  const logoBase64 = await loadAssetAsBase64(srmLogo);

  // ===== PAGE 1 =====
  
  // Title - Campus Care – Issue Report (left aligned, bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...textColor);
  doc.text('Campus Care – Issue Report', margin, yPos + 10);
  
  // SRM Logo (top right)
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', pageWidth - margin - 45, yPos - 5, 45, 25);
  }
  
  yPos = 45;
  
  // Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SRM Institute of Science and Technology', margin, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Campus Care – Digital Issue Reporting System', margin, yPos);
  
  yPos += 18;
  
  // Helper to draw section header (italic, bold)
  const drawSectionHeader = (title: string, y: number): number => {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(title, margin, y);
    return y + 8;
  };
  
  // Helper to draw table row (matching template style)
  const drawTableRow = (label: string, value: string, y: number, isFirst: boolean, isLast: boolean): number => {
    const rowHeight = 9;
    const labelWidth = 55;
    
    // Draw cell borders
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    
    // Left cell
    doc.rect(margin, y, labelWidth, rowHeight);
    // Right cell
    doc.rect(margin + labelWidth, y, contentWidth - labelWidth, rowHeight);
    
    // Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text(label, margin + 3, y + 6);
    doc.text(value || '', margin + labelWidth + 3, y + 6);
    
    return y + rowHeight;
  };
  
  // Student Details Section
  yPos = drawSectionHeader('Student Details', yPos);
  
  yPos = drawTableRow('Student Name', student.name || '', yPos, true, false);
  yPos = drawTableRow('Registration Number', student.registration_number || '', yPos, false, false);
  yPos = drawTableRow('Degree / Department', `${student.degree || ''} / ${student.department || ''}`, yPos, false, false);
  yPos = drawTableRow('Email ID', student.email, yPos, false, false);
  yPos = drawTableRow('Phone Number', student.phone_number || '', yPos, false, true);
  
  yPos += 15;
  
  // Issue Details Section
  yPos = drawSectionHeader('Issue Details', yPos);
  
  yPos = drawTableRow('Issue Category', categoryLabels[issue.category] || issue.category, yPos, true, false);
  yPos = drawTableRow('Issue Description', issue.description || '', yPos, false, false);
  yPos = drawTableRow('Urgency /Severity', severityLabels[issue.severity] || issue.severity, yPos, false, false);
  yPos = drawTableRow('Date Reported', format(new Date(issue.created_at), 'PPP'), yPos, false, true);
  
  yPos += 15;
  
  // Location Information Section
  const locationParts = parseLocation(issue.location);
  yPos = drawSectionHeader('Location Information', yPos);
  
  yPos = drawTableRow('Building Name', locationParts.building, yPos, true, false);
  yPos = drawTableRow('Floor Number', locationParts.floor, yPos, false, false);
  yPos = drawTableRow('Room / Area Description', locationParts.room, yPos, false, true);
  
  yPos += 15;
  
  // Issue Status Section
  yPos = drawSectionHeader('Issue Status', yPos);
  
  const statusLabel = issue.status === 'resolved' ? 'Resolved' : 
                      issue.status === 'in_progress' ? 'In Progress' : 'Submitted';
  yPos = drawTableRow('Current Status', statusLabel, yPos, true, false);
  
  const resolvedDate = issue.status === 'resolved' && issue.updated_at 
    ? format(new Date(issue.updated_at), 'PPP') 
    : '';
  yPos = drawTableRow('Date Resolved', resolvedDate, yPos, false, true);
  
  // ===== PAGE 2 - Images =====
  doc.addPage();
  yPos = margin;
  
  // Image Evidence header (italic, bold)
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(14);
  doc.setTextColor(...textColor);
  doc.text('Image Evidence', margin, yPos);
  
  yPos += 12;
  
  // Before Resolution label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Before Resolution:', margin, yPos);
  yPos += 8;
  
  const imageHeight = 75;
  const imageWidth = contentWidth - 20;
  const imageX = margin + 10;
  
  // Before image area (black background, sharp corners)
  doc.setFillColor(0, 0, 0);
  doc.rect(imageX, yPos, imageWidth, imageHeight, 'F');
  
  if (issue.image_url) {
    try {
      const beforeImageBase64 = await loadImageAsBase64(issue.image_url);
      if (beforeImageBase64) {
        // Calculate dimensions to maintain aspect ratio
        doc.addImage(beforeImageBase64, 'JPEG', imageX + 2, yPos + 2, imageWidth - 4, imageHeight - 4);
      } else {
        // Centered placeholder text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        const text = 'Students Uploaded Photo should be printed here.';
        const textWidth = doc.getTextWidth(text);
        doc.text(text, imageX + (imageWidth - textWidth) / 2, yPos + imageHeight / 2);
      }
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      const text = 'Students Uploaded Photo should be printed here.';
      const textWidth = doc.getTextWidth(text);
      doc.text(text, imageX + (imageWidth - textWidth) / 2, yPos + imageHeight / 2);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    const text = 'Students Uploaded Photo should be printed here.';
    const textWidth = doc.getTextWidth(text);
    doc.text(text, imageX + (imageWidth - textWidth) / 2, yPos + imageHeight / 2);
  }
  
  yPos += imageHeight + 15;
  
  // After Resolution label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.text('After Resolution:', margin, yPos);
  yPos += 10;
  
  // After image area (dark gray background with rounded corners)
  const afterImageHeight = 80;
  const cornerRadius = 10;
  
  // Draw rounded rectangle
  doc.setFillColor(50, 50, 50);
  
  // Using a custom rounded rect approach
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    doc.setFillColor(50, 50, 50);
    // Main rectangle
    doc.roundedRect(x, y, w, h, r, r, 'F');
  };
  
  drawRoundedRect(imageX, yPos, imageWidth, afterImageHeight, cornerRadius);
  
  if (issue.status === 'resolved' && issue.resolved_image_url) {
    try {
      const afterImageBase64 = await loadImageAsBase64(issue.resolved_image_url);
      if (afterImageBase64) {
        // Add image within the rounded area
        doc.addImage(afterImageBase64, 'JPEG', imageX + 5, yPos + 5, imageWidth - 10, afterImageHeight - 10);
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        const text = 'Maintenance Uploaded Photo should be printed here';
        const textWidth = doc.getTextWidth(text);
        doc.text(text, imageX + (imageWidth - textWidth) / 2, yPos + afterImageHeight / 2);
      }
    } catch {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      const text = 'Maintenance Uploaded Photo should be printed here';
      const textWidth = doc.getTextWidth(text);
      doc.text(text, imageX + (imageWidth - textWidth) / 2, yPos + afterImageHeight / 2);
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    const text = issue.status === 'resolved' ? 'Maintenance Uploaded Photo should be printed here' : 'Not Available';
    const textWidth = doc.getTextWidth(text);
    doc.text(text, imageX + (imageWidth - textWidth) / 2, yPos + afterImageHeight / 2);
  }
  
  yPos += afterImageHeight + 25;
  
  // Footer
  const currentDate = format(new Date(), 'PPP');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...grayText);
  doc.text(`Generated via Campus Care | Date: ${currentDate}`, margin, yPos);
  
  // Return as blob
  return doc.output('blob');
};

export const getReportFileName = (issueId: string): string => {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  return `CampusCare_Issue_${issueId.slice(0, 8)}_${dateStr}.pdf`;
};
