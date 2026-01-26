import jsPDF from 'jspdf';
import { format } from 'date-fns';

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
  if (!location) return { building: 'Not specified', floor: 'Not specified', room: 'Not specified' };
  
  const parts = location.split(',').map(p => p.trim());
  return {
    building: parts[0] || 'Not specified',
    floor: parts[1] || 'Not specified',
    room: parts[2] || 'Not specified',
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

export const generateIssuePDF = async (
  student: StudentDetails,
  issue: IssueDetails
): Promise<Blob> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const textColor: [number, number, number] = [31, 41, 55]; // Dark gray
  const lightGray: [number, number, number] = [156, 163, 175];
  const tableHeaderBg: [number, number, number] = [243, 244, 246];
  
  let yPos = margin;

  // Helper function to add text
  const addText = (text: string, x: number, y: number, options?: { 
    fontSize?: number; 
    fontStyle?: 'normal' | 'bold'; 
    color?: [number, number, number];
    align?: 'left' | 'center' | 'right';
  }) => {
    const { fontSize = 10, fontStyle = 'normal', color = textColor, align = 'left' } = options || {};
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(...color);
    
    let xPos = x;
    if (align === 'center') {
      xPos = pageWidth / 2;
    } else if (align === 'right') {
      xPos = pageWidth - margin;
    }
    
    doc.text(text, xPos, y, { align });
    return y;
  };

  // Helper to draw table row
  const drawTableRow = (label: string, value: string, y: number, isHeader = false): number => {
    const rowHeight = 10;
    const labelWidth = 60;
    
    // Background for header
    if (isHeader) {
      doc.setFillColor(...tableHeaderBg);
      doc.rect(margin, y - 6, contentWidth, rowHeight, 'F');
    }
    
    // Border
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - 6, labelWidth, rowHeight);
    doc.rect(margin + labelWidth, y - 6, contentWidth - labelWidth, rowHeight);
    
    // Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(label, margin + 3, y);
    
    doc.setFont('helvetica', 'normal');
    doc.text(value || '', margin + labelWidth + 3, y);
    
    return y + rowHeight;
  };

  // ===== PAGE 1 =====
  
  // Header - Campus Care title
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  addText('Campus Care – Issue Report', 0, 15, { 
    fontSize: 20, 
    fontStyle: 'bold', 
    color: [255, 255, 255],
    align: 'center' 
  });
  
  addText('SRM Institute of Science and Technology', 0, 25, { 
    fontSize: 11, 
    color: [255, 255, 255],
    align: 'center' 
  });
  
  yPos = 45;
  
  // Subtitle
  addText('Campus Care – Digital Issue Reporting System', 0, yPos, { 
    fontSize: 12, 
    fontStyle: 'bold',
    align: 'center' 
  });
  
  yPos = 60;
  
  // Student Details Section
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  addText('Student Details', margin + 3, yPos + 5.5, { 
    fontSize: 11, 
    fontStyle: 'bold', 
    color: [255, 255, 255] 
  });
  yPos += 14;
  
  yPos = drawTableRow('Student Name', student.name || 'Not provided', yPos);
  yPos = drawTableRow('Registration Number', student.registration_number || 'Not provided', yPos);
  yPos = drawTableRow('Degree / Department', `${student.degree || 'N/A'} / ${student.department || 'N/A'}`, yPos);
  yPos = drawTableRow('Email ID', student.email, yPos);
  yPos = drawTableRow('Phone Number', student.phone_number || 'Not provided', yPos);
  
  yPos += 10;
  
  // Issue Details Section
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  addText('Issue Details', margin + 3, yPos + 5.5, { 
    fontSize: 11, 
    fontStyle: 'bold', 
    color: [255, 255, 255] 
  });
  yPos += 14;
  
  yPos = drawTableRow('Issue Category', categoryLabels[issue.category] || issue.category, yPos);
  yPos = drawTableRow('Issue Description', issue.description || 'Not provided', yPos);
  yPos = drawTableRow('Urgency / Severity', severityLabels[issue.severity] || issue.severity, yPos);
  yPos = drawTableRow('Date & Time Reported', format(new Date(issue.created_at), 'PPpp'), yPos);
  
  yPos += 10;
  
  // Location Information Section
  const locationParts = parseLocation(issue.location);
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  addText('Location Information', margin + 3, yPos + 5.5, { 
    fontSize: 11, 
    fontStyle: 'bold', 
    color: [255, 255, 255] 
  });
  yPos += 14;
  
  yPos = drawTableRow('Building Name', locationParts.building, yPos);
  yPos = drawTableRow('Floor Number', locationParts.floor, yPos);
  yPos = drawTableRow('Room / Area Description', locationParts.room, yPos);
  
  yPos += 10;
  
  // Issue Status Section
  doc.setFillColor(...primaryColor);
  doc.rect(margin, yPos, contentWidth, 8, 'F');
  addText('Issue Status', margin + 3, yPos + 5.5, { 
    fontSize: 11, 
    fontStyle: 'bold', 
    color: [255, 255, 255] 
  });
  yPos += 14;
  
  const statusLabel = issue.status === 'resolved' ? 'Resolved' : 
                      issue.status === 'in_progress' ? 'In Progress' : 'Submitted';
  yPos = drawTableRow('Current Status', statusLabel, yPos);
  
  const resolvedDate = issue.status === 'resolved' && issue.updated_at 
    ? format(new Date(issue.updated_at), 'PPpp') 
    : 'N/A';
  yPos = drawTableRow('Date & Time Resolved', resolvedDate, yPos);
  
  // ===== PAGE 2 - Images =====
  doc.addPage();
  yPos = margin;
  
  // Header for page 2
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 20, 'F');
  addText('Image Evidence', 0, 13, { 
    fontSize: 16, 
    fontStyle: 'bold', 
    color: [255, 255, 255],
    align: 'center' 
  });
  
  yPos = 35;
  
  // Before Resolution Section
  addText('Before Resolution:', margin, yPos, { fontSize: 12, fontStyle: 'bold' });
  yPos += 8;
  
  const imageHeight = 80;
  const imageWidth = contentWidth;
  
  // Draw border for before image
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, yPos, imageWidth, imageHeight);
  
  if (issue.image_url) {
    try {
      const beforeImageBase64 = await loadImageAsBase64(issue.image_url);
      if (beforeImageBase64) {
        doc.addImage(beforeImageBase64, 'JPEG', margin + 2, yPos + 2, imageWidth - 4, imageHeight - 4);
      } else {
        addText('Image could not be loaded', margin + imageWidth / 2 - 25, yPos + imageHeight / 2, { 
          fontSize: 10, 
          color: lightGray 
        });
      }
    } catch {
      addText('Image could not be loaded', margin + imageWidth / 2 - 25, yPos + imageHeight / 2, { 
        fontSize: 10, 
        color: lightGray 
      });
    }
  } else {
    addText('No image uploaded', margin + imageWidth / 2 - 20, yPos + imageHeight / 2, { 
      fontSize: 10, 
      color: lightGray 
    });
  }
  
  yPos += imageHeight + 15;
  
  // After Resolution Section
  addText('After Resolution:', margin, yPos, { fontSize: 12, fontStyle: 'bold' });
  yPos += 8;
  
  // Draw darker border/background for after image
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, imageWidth, imageHeight, 'F');
  doc.setDrawColor(180, 180, 180);
  doc.rect(margin, yPos, imageWidth, imageHeight);
  
  if (issue.status === 'resolved' && issue.resolved_image_url) {
    try {
      const afterImageBase64 = await loadImageAsBase64(issue.resolved_image_url);
      if (afterImageBase64) {
        doc.addImage(afterImageBase64, 'JPEG', margin + 2, yPos + 2, imageWidth - 4, imageHeight - 4);
      } else {
        addText('Image could not be loaded', margin + imageWidth / 2 - 25, yPos + imageHeight / 2, { 
          fontSize: 10, 
          color: lightGray 
        });
      }
    } catch {
      addText('Image could not be loaded', margin + imageWidth / 2 - 25, yPos + imageHeight / 2, { 
        fontSize: 10, 
        color: lightGray 
      });
    }
  } else {
    addText('Not Available', margin + imageWidth / 2 - 15, yPos + imageHeight / 2, { 
      fontSize: 11, 
      fontStyle: 'bold',
      color: lightGray 
    });
  }
  
  yPos += imageHeight + 20;
  
  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  
  const currentDate = format(new Date(), 'PPpp');
  addText(`Generated via Campus Care | Date: ${currentDate}`, 0, yPos, { 
    fontSize: 9, 
    color: lightGray,
    align: 'center' 
  });
  
  // Return as blob
  return doc.output('blob');
};

export const getReportFileName = (issueId: string): string => {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  return `CampusCare_Issue_${issueId.slice(0, 8)}_${dateStr}.pdf`;
};