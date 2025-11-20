import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, message, pdf_url } = await req.json();

    if (!phone_number || !message) {
      throw new Error("phone_number and message are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");
    const whatsappApiUrl = Deno.env.get("WHATSAPP_API_URL");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Build WhatsApp message payload
    const payload: any = {
      to: phone_number,
      message: message,
    };

    // If PDF URL is provided, attach it
    if (pdf_url) {
      payload.media = {
        type: "document",
        url: pdf_url,
      };
    }

    // Send via WhatsApp API (using Twilio, WhatsApp Business API, or similar)
    // Note: You'll need to configure your WhatsApp API provider
    if (whatsappApiUrl && whatsappApiKey) {
      const whatsappResponse = await fetch(whatsappApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!whatsappResponse.ok) {
        const errorText = await whatsappResponse.text();
        console.error("WhatsApp API error:", whatsappResponse.status, errorText);
        throw new Error(`WhatsApp API error: ${whatsappResponse.status}`);
      }

      const result = await whatsappResponse.json();

      // Log the reminder as sent
      if (req.headers.get("reminder-id")) {
        await supabase
          .from("reminders")
          .update({ sent: true })
          .eq("id", req.headers.get("reminder-id"));
      }

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Mock response if WhatsApp API is not configured
      console.log("WhatsApp API not configured. Mock send:", payload);
      return new Response(
        JSON.stringify({
          success: true,
          message: "WhatsApp API not configured. This is a mock response.",
          payload,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

