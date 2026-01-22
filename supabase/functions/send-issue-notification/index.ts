import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IssueNotificationRequest {
  issueId: string;
  category: string;
  severity: string;
  location: string;
  urgency: string;
  imageUrl: string;
  studentEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { issueId, category, severity, location, urgency, imageUrl, studentEmail }: IssueNotificationRequest = await req.json();

    const severityColor = severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f59e0b' : '#22c55e';
    const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);

    const emailResponse = await resend.emails.send({
      from: "Campus Fix <onboarding@resend.dev>",
      to: ["vt9575@srmist.edu.in"],
      subject: `[Campus Issue] ${severityLabel} – ${category} (Issue ID: ${issueId.slice(0, 8)})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔧 Campus Fix - New Issue Report</h1>
          </div>
          
          <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #64748b;">Issue ID:</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${issueId}</code>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #64748b;">Student Email:</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  ${studentEmail}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #64748b;">Category:</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px;">${category}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #64748b;">Severity:</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <span style="background: ${severityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px;">${severityLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #64748b;">Location:</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  📍 ${location}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  <strong style="color: #64748b;">Urgency:</strong>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                  ⚡ ${urgency}
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0;">
                  <strong style="color: #64748b;">Timestamp:</strong>
                </td>
                <td style="padding: 10px 0;">
                  ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </td>
              </tr>
            </table>
            
            <div style="margin-top: 20px;">
              <strong style="color: #64748b;">Attached Image:</strong>
              <div style="margin-top: 10px;">
                <img src="${imageUrl}" alt="Issue Image" style="max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0;" />
              </div>
            </div>
          </div>
          
          <div style="background: #1e40af; color: white; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">This is an automated notification from Campus Fix</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-issue-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
