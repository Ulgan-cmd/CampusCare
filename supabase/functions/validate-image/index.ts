import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ValidateImageRequest {
  imageBase64: string;
}

interface ValidationResponse {
  isValid: boolean;
  reason: string;
  confidence: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 }: ValidateImageRequest = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Call Lovable AI Gateway with vision capability
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an image validator for an ENVIRONMENTAL issue reporting system at a university campus. Your job is to determine if an uploaded image shows a legitimate ENVIRONMENTAL issue.

VALID images MUST show one of these ENVIRONMENTAL issues only:
- AIR ISSUES: Visible air pollution, smoke, dust clouds, emissions from vehicles/generators, haze, smog, visible odour sources (garbage heaps causing smell, stagnant water causing smell)
- WATER ISSUES: Water leaks, pipe leakage, flooding, water stagnation, poor water quality (discolored water), drainage problems, blocked drains, overflowing drains, sewage issues
- WASTE ISSUES: Garbage spillage, overflowing bins, littering, improper waste disposal, scattered trash
- NOISE-RELATED: Equipment or machinery that could cause noise pollution (though noise itself cannot be shown in images)

INVALID images include:
- Furniture damage (broken chairs, desks, benches)
- Electrical issues (exposed wires, broken switches)
- Civil/structural damage (cracks, holes, broken tiles, damaged walls)
- Fire safety issues
- Broken fixtures (doors, windows, lights, fans)
- Selfies or portraits
- Food or beverages
- Personal items (phones, bags, books)
- Screenshots or memes
- Animals (unless related to environmental issue)
- Random objects not showing environmental damage
- Blurry or unclear images where no issue is visible

REMEMBER: Only ENVIRONMENTAL issues (Air, Water, Waste, Noise-related) are valid. Reject all infrastructure, furniture, electrical, civil, or structural issues.

Respond with a JSON object only:
{
  "isValid": true/false,
  "reason": "Brief explanation of why the image is valid or invalid",
  "confidence": 0-100
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image and determine if it shows a valid ENVIRONMENTAL issue (air pollution, water problems, waste spillage, or noise-related sources) that should be reported. Remember: only environmental issues are valid - reject any furniture, electrical, civil, or structural damage."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON response from AI
    let validation: ValidationResponse;
    try {
      // Extract JSON from the response (AI might include markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      // Default to allowing the image if parsing fails
      validation = {
        isValid: true,
        reason: "Unable to analyze image - allowing submission",
        confidence: 50
      };
    }

    console.log("Image validation result:", validation);

    return new Response(JSON.stringify(validation), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in validate-image function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        isValid: true, // Default to allowing on error
        reason: "Validation service unavailable",
        confidence: 0
      }),
      {
        status: 200, // Return 200 so the frontend can handle gracefully
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
